import { calculateAuditCompliance, calculatePersonScores } from "./or-audit";
import { AuditCategory, AuditSession, ScoreLink } from "../types";

export interface AdvisorSamplingProgressItem {
  advisorName: string;
  sampledCount: number;
}

export interface BlendedServiceAdvisorScoreRow {
  personName: string;
  compliance: number;
  evaluations: number;
  areas: string[];
  linkedItems: number;
}

export interface BlendedTechnicianScoreRow {
  personName: string;
  compliance: number;
  ordersScore: number | null;
  technicianAuditScore: number | null;
  areas: string[];
  evaluations: number;
}

export interface AreaScoreRow {
  role: string;
  average: number | null;
  evaluations: number;
  linkedItems: number;
}

export interface AuditHistorySummary {
  filteredHistory: AuditSession[];
  recentAudits: AuditSession[];
  historyAverageScore: number;
  nonCompliantAudits: number;
  latestHistoryItem: AuditSession | null;
}

export interface AuditProcessMetrics {
  sampledOrdersAdvisorProgress: AdvisorSamplingProgressItem[];
  completedOrdersAdvisorsCount: number;
  sampledOrdersProgress: number;
  sampledServiceAdvisorProgress: AdvisorSamplingProgressItem[];
  completedServiceAdvisorTargetsCount: number;
  sampledServiceAdvisorClientsProgress: number;
  blendedServiceAdvisorScoreRows: BlendedServiceAdvisorScoreRow[];
  blendedTechnicianScoreRows: BlendedTechnicianScoreRow[];
  areaScoreRows: AreaScoreRow[];
  technicianReviewSessions: AuditSession[];
}

interface BuildAuditHistorySummaryParams {
  history: AuditSession[];
  searchTerm: string;
}

interface BuildAuditProcessMetricsParams {
  history: AuditSession[];
  completedSessions: AuditSession[];
  sessionDate?: string;
  sessionLocation?: AuditSession["location"];
  currentAuditBatchName?: string;
  auditCategories: AuditCategory[];
  configuredOrderAdvisorNames: readonly string[];
  configuredServiceAdvisorNames: readonly string[];
}

function dedupeSessions(
  sessions: AuditSession[],
  getFallbackId: (session: AuditSession) => string,
) {
  return Array.from(
    sessions
      .reduce((acc, session) => {
        const sessionId = session.id || getFallbackId(session);
        if (!acc.has(sessionId)) {
          acc.set(sessionId, session);
        }
        return acc;
      }, new Map<string, AuditSession>())
      .values(),
  );
}

function buildScopedSessionMatcher(currentAuditBatchName: string, monthKey: string, location?: AuditSession["location"]) {
  return (auditSession: AuditSession) => {
    if (currentAuditBatchName) {
      return auditSession.auditBatchName?.trim() === currentAuditBatchName;
    }

    const sameMonth = auditSession.date?.startsWith(monthKey);
    const sameLocation = location ? auditSession.location === location : true;
    return Boolean(sameMonth && sameLocation);
  };
}

function buildProgressRows(
  configuredNames: readonly string[],
  sampledCountByName: Map<string, number>,
  targetPerPerson: number,
) {
  return [
    ...configuredNames.map((advisorName) => ({
      advisorName,
      sampledCount: sampledCountByName.get(advisorName) ?? 0,
    })),
    ...Array.from(sampledCountByName.entries())
      .filter(([advisorName]) => !configuredNames.includes(advisorName))
      .map(([advisorName, sampledCount]) => ({ advisorName, sampledCount })),
  ].sort((left, right) => {
    const completionDelta = (right.sampledCount >= targetPerPerson ? 1 : 0) - (left.sampledCount >= targetPerPerson ? 1 : 0);
    if (completionDelta !== 0) {
      return completionDelta;
    }

    return right.sampledCount - left.sampledCount;
  });
}

function getItemScoreLinks(item: AuditSession["items"][number]): ScoreLink[] {
  if (Array.isArray(item.scoreLinks) && item.scoreLinks.length > 0) {
    return item.scoreLinks
      .map((link) => ({
        area: typeof link.area === "string" ? link.area.trim() : "",
        weight: typeof link.weight === "number" && Number.isFinite(link.weight) ? link.weight : 0,
        destinationItemId: typeof link.destinationItemId === "string" ? link.destinationItemId.trim() : "",
        destinationItemText: typeof link.destinationItemText === "string" ? link.destinationItemText.trim() : "",
      }))
      .filter((link) => link.area && link.weight > 0)
      .map((link) => ({
        area: link.area,
        weight: Math.min(100, Math.max(1, Math.round(link.weight))),
        destinationItemId: link.destinationItemId,
        destinationItemText: link.destinationItemText,
      }));
  }

  if (Array.isArray(item.scoreAreas) && item.scoreAreas.length > 0) {
    const evenWeight = Math.max(1, Math.round(100 / item.scoreAreas.length));
    return item.scoreAreas
      .map((area) => area.trim())
      .filter(Boolean)
      .map((area) => ({ area, weight: evenWeight }));
  }

  return [];
}

export function buildAuditHistorySummary({
  history,
  searchTerm,
}: BuildAuditHistorySummaryParams): AuditHistorySummary {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredHistory = history.filter((item) => {
    if (!normalizedSearchTerm) {
      return true;
    }

    return item.staffName?.toLowerCase().includes(normalizedSearchTerm)
      || item.orderNumber?.toLowerCase().includes(normalizedSearchTerm)
      || item.location.toLowerCase().includes(normalizedSearchTerm)
      || item.items[0]?.category.toLowerCase().includes(normalizedSearchTerm);
  });

  return {
    filteredHistory,
    recentAudits: history.slice(0, 3),
    historyAverageScore: Math.round(filteredHistory.reduce((acc, item) => acc + item.totalScore, 0) / (filteredHistory.length || 1)),
    nonCompliantAudits: filteredHistory.filter((item) => item.totalScore < 90).length,
    latestHistoryItem: filteredHistory[0] ?? null,
  };
}

export function buildAuditProcessMetrics({
  history,
  completedSessions,
  sessionDate,
  sessionLocation,
  currentAuditBatchName = "",
  auditCategories,
  configuredOrderAdvisorNames,
  configuredServiceAdvisorNames,
}: BuildAuditProcessMetricsParams): AuditProcessMetrics {
  const allSessions = [...history, ...completedSessions];
  const currentSamplingMonthKey = (sessionDate || new Date().toISOString().split("T")[0]).slice(0, 7);
  const isSessionInCurrentSamplingScope = buildScopedSessionMatcher(currentAuditBatchName, currentSamplingMonthKey, sessionLocation);

  const ordersTargetPerAdvisor = 10;
  const orderAdvisorsTargetCount = Math.max(configuredOrderAdvisorNames.length, 1);
  const serviceAdvisorTargetClients = 2;

  const sampledOrdersHistory = dedupeSessions(
    allSessions.filter((auditSession) => {
      const isOrdersSession = auditSession.entityType === "or"
        || auditSession.role === "Ordenes"
        || Boolean(auditSession.orderNumber?.trim());

      return isOrdersSession && isSessionInCurrentSamplingScope(auditSession);
    }),
    (auditSession) => `${auditSession.role || "sin-rol"}-${auditSession.date || "sin-fecha"}-${auditSession.orderNumber || "sin-or"}-${auditSession.participants?.asesorServicio || auditSession.staffName || "sin-asesor"}`,
  );

  const sampledOrdersByAdvisor = sampledOrdersHistory.reduce((acc, auditSession) => {
    const advisorName = auditSession.participants?.asesorServicio?.trim() || auditSession.staffName?.trim();
    if (!advisorName) {
      return acc;
    }

    acc.set(advisorName, (acc.get(advisorName) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());

  const sampledOrdersAdvisorProgress = buildProgressRows(
    configuredOrderAdvisorNames,
    sampledOrdersByAdvisor,
    ordersTargetPerAdvisor,
  );

  const completedOrdersAdvisorsCount = sampledOrdersAdvisorProgress.filter(
    (advisorProgress) => advisorProgress.sampledCount >= ordersTargetPerAdvisor,
  ).length;

  const sampledOrdersProgress = Math.round(
    (Array.from(sampledOrdersByAdvisor.values())
      .sort((left, right) => right - left)
      .slice(0, orderAdvisorsTargetCount)
      .reduce((total, advisorCount) => total + Math.min(advisorCount, ordersTargetPerAdvisor), 0)
      / (ordersTargetPerAdvisor * orderAdvisorsTargetCount || 1))
      * 100,
  );

  const sampledServiceAdvisorHistory = dedupeSessions(
    allSessions.filter((auditSession) =>
      auditSession.role === "Asesores de servicio" && isSessionInCurrentSamplingScope(auditSession),
    ),
    (auditSession) => `${auditSession.role || "sin-rol"}-${auditSession.date || "sin-fecha"}-${auditSession.staffName || "sin-asesor"}-${auditSession.clientIdentifier || "sin-cliente"}`,
  );

  const sampledServiceAdvisorByName = sampledServiceAdvisorHistory.reduce((acc, auditSession) => {
    const advisorName = auditSession.staffName?.trim();
    if (!advisorName) {
      return acc;
    }

    acc.set(advisorName, (acc.get(advisorName) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());

  const sampledServiceAdvisorProgress = buildProgressRows(
    configuredServiceAdvisorNames,
    sampledServiceAdvisorByName,
    serviceAdvisorTargetClients,
  );

  const completedServiceAdvisorTargetsCount = sampledServiceAdvisorProgress.filter(
    (advisorProgress) => advisorProgress.sampledCount >= serviceAdvisorTargetClients,
  ).length;

  const sampledServiceAdvisorClientsProgress = Math.round(
    (Array.from(sampledServiceAdvisorByName.values())
      .sort((left, right) => right - left)
      .slice(0, Math.max(configuredServiceAdvisorNames.length, 1))
      .reduce((total, advisorCount) => total + Math.min(advisorCount, serviceAdvisorTargetClients), 0)
      / (serviceAdvisorTargetClients * Math.max(configuredServiceAdvisorNames.length, 1) || 1))
      * 100,
  );

  const auditSessionsWithCurrentBatch = dedupeSessions(
    allSessions,
    (auditSession) => `${auditSession.role || "sin-rol"}-${auditSession.date || "sin-fecha"}-${auditSession.orderNumber || "sin-or"}-${auditSession.staffName || auditSession.participants?.asesorServicio || "sin-persona"}`,
  );

  const scoreScopeMonthKey = (sessionDate || new Date().toISOString().slice(0, 10)).slice(0, 7);
  const processScoreSessions = auditSessionsWithCurrentBatch.filter((auditSession) => {
    if (currentAuditBatchName && auditSession.auditBatchName?.trim() === currentAuditBatchName) {
      return true;
    }

    const isSameMonth = auditSession.date?.startsWith(scoreScopeMonthKey);
    const isSameLocation = sessionLocation ? auditSession.location === sessionLocation : true;
    return Boolean(isSameMonth && isSameLocation);
  });

  const processOrdersSessions = processScoreSessions.filter((auditSession) =>
    auditSession.entityType === "or"
      || auditSession.role === "Ordenes"
      || Boolean(auditSession.orderNumber?.trim()),
  );

  const advisorScoreRows = calculatePersonScores(processOrdersSessions, "asesor", "asesorServicio");
  const serviceAdvisorScoreRows = Array.from(
    processScoreSessions.reduce((acc, auditSession) => {
      if (auditSession.role !== "Asesores de servicio") {
        return acc;
      }

      const advisorName = auditSession.staffName?.trim();
      if (!advisorName) {
        return acc;
      }

      const current = acc.get(advisorName) ?? { total: 0, count: 0 };
      current.total += auditSession.totalScore || 0;
      current.count += 1;
      acc.set(advisorName, current);
      return acc;
    }, new Map<string, { total: number; count: number }>())
      .entries(),
  )
    .map(([personName, metrics]) => ({
      personName,
      compliance: Math.round(metrics.total / metrics.count),
      evaluations: metrics.count,
      linkedItems: 0,
    }))
    .sort((left, right) => right.compliance - left.compliance);

  const blendedServiceAdvisorScoreRows = Array.from(
    serviceAdvisorScoreRows.reduce((acc, row) => {
      const current = acc.get(row.personName) ?? {
        ordersScore: null as number | null,
        serviceAdvisorScore: null as number | null,
        evaluations: 0,
        areas: new Set<string>(),
      };

      current.serviceAdvisorScore = row.compliance;
      current.evaluations += row.evaluations;
      current.areas.add("Asesores de servicio");
      acc.set(row.personName, current);
      return acc;
    }, advisorScoreRows.reduce((acc, row) => {
      const current = acc.get(row.personName) ?? {
        ordersScore: null as number | null,
        serviceAdvisorScore: null as number | null,
        evaluations: 0,
        areas: new Set<string>(),
      };

      current.ordersScore = row.compliance;
      current.evaluations += row.evaluations;
      current.areas.add("Ordenes");
      acc.set(row.personName, current);
      return acc;
    }, new Map<string, { ordersScore: number | null; serviceAdvisorScore: number | null; evaluations: number; areas: Set<string> }>()))
      .entries(),
  )
    .map(([personName, metrics]) => {
      const areaScores = [metrics.ordersScore, metrics.serviceAdvisorScore].filter((value): value is number => typeof value === "number");
      return {
        personName,
        compliance: areaScores.length > 0 ? Math.round(areaScores.reduce((acc, value) => acc + value, 0) / areaScores.length) : 0,
        evaluations: metrics.evaluations,
        areas: Array.from(metrics.areas).sort(),
        linkedItems: 0,
      };
    })
    .sort((left, right) => right.compliance - left.compliance);

  const technicianScoreRows = calculatePersonScores(processOrdersSessions, "tecnico", "tecnico");
  const technicianCategoryScoreRows = Array.from(
    processScoreSessions.reduce((acc, auditSession) => {
      const roleName = auditSession.role || auditSession.items[0]?.category || "";
      if (roleName !== "T?cnicos") {
        return acc;
      }

      const technicianName = auditSession.staffName?.trim();
      if (!technicianName) {
        return acc;
      }

      const current = acc.get(technicianName) ?? { total: 0, count: 0 };
      current.total += auditSession.totalScore || 0;
      current.count += 1;
      acc.set(technicianName, current);
      return acc;
    }, new Map<string, { total: number; count: number }>())
      .entries(),
  )
    .map(([personName, metrics]) => ({
      personName,
      compliance: Math.round(metrics.total / metrics.count),
      evaluations: metrics.count,
    }))
    .sort((left, right) => right.compliance - left.compliance);

  const blendedTechnicianScoreRows = Array.from(
    technicianCategoryScoreRows.reduce((acc, row) => {
      const current = acc.get(row.personName) ?? {
        ordersScore: null as number | null,
        technicianScore: null as number | null,
        evaluations: 0,
      };

      current.technicianScore = row.compliance;
      current.evaluations += row.evaluations;
      acc.set(row.personName, current);
      return acc;
    }, technicianScoreRows.reduce((acc, row) => {
      const current = acc.get(row.personName) ?? {
        ordersScore: null as number | null,
        technicianScore: null as number | null,
        evaluations: 0,
      };

      current.ordersScore = row.compliance;
      current.evaluations += row.evaluations;
      acc.set(row.personName, current);
      return acc;
    }, new Map<string, { ordersScore: number | null; technicianScore: number | null; evaluations: number }>()))
      .entries(),
  )
    .map(([personName, metrics]) => {
      const areaScores = [metrics.ordersScore, metrics.technicianScore].filter((value): value is number => typeof value === "number");
      return {
        personName,
        compliance: areaScores.length > 0 ? Math.round(areaScores.reduce((acc, value) => acc + value, 0) / areaScores.length) : 0,
        ordersScore: metrics.ordersScore,
        technicianAuditScore: metrics.technicianScore,
        areas: [
          typeof metrics.ordersScore === "number" ? "Ordenes" : null,
          typeof metrics.technicianScore === "number" ? "T?cnicos" : null,
        ].filter((value): value is string => Boolean(value)),
        evaluations: metrics.evaluations,
      };
    })
    .sort((left, right) => right.compliance - left.compliance);

  const linkedAreaNames = Array.from(
    new Set(
      processScoreSessions.flatMap((auditSession) =>
        auditSession.items.flatMap((item) => getItemScoreLinks(item).map((link) => link.area)),
      ),
    ),
  ).filter((value) => typeof value === "string" && value.trim());

  const areaNames = Array.from(
    new Set([
      ...auditCategories.map((category) => category.name),
      ...linkedAreaNames,
    ]),
  );

  const areaScoreMetrics = areaNames.reduce((acc, areaName) => {
    acc.set(areaName, { total: 0, weight: 0, linkedItems: 0, contributions: 0 });
    return acc;
  }, new Map<string, { total: number; weight: number; linkedItems: number; contributions: number }>());

  const itemComplianceById = new Map<string, number>();
  processScoreSessions.forEach((auditSession) => {
    auditSession.items.forEach((item) => {
      itemComplianceById.set(item.id, calculateAuditCompliance([item]).compliance);
    });
  });

  const inboundLinksByDestinationItemId = new Map<string, Array<{ sourceItemId: string; weight: number }>>();
  processScoreSessions.forEach((auditSession) => {
    auditSession.items.forEach((item) => {
      getItemScoreLinks(item).forEach((link) => {
        if (!link.destinationItemId) {
          return;
        }

        const current = inboundLinksByDestinationItemId.get(link.destinationItemId) ?? [];
        current.push({ sourceItemId: item.id, weight: link.weight });
        inboundLinksByDestinationItemId.set(link.destinationItemId, current);
      });
    });
  });

  const getEffectiveItemCompliance = (item: AuditSession["items"][number]) => {
    const inboundLinks = inboundLinksByDestinationItemId.get(item.id) ?? [];
    if (inboundLinks.length > 0) {
      const linkedWeights = inboundLinks
        .map((link) => {
          const sourceCompliance = itemComplianceById.get(link.sourceItemId);
          if (typeof sourceCompliance !== "number") {
            return null;
          }

          return {
            compliance: sourceCompliance,
            weight: link.weight,
          };
        })
        .filter((value): value is { compliance: number; weight: number } => Boolean(value));

      if (linkedWeights.length > 0) {
        const totalWeight = linkedWeights.reduce((acc, link) => acc + link.weight, 0);
        const totalCompliance = linkedWeights.reduce((acc, link) => acc + (link.compliance * link.weight), 0);
        return {
          compliance: totalWeight > 0 ? Math.round(totalCompliance / totalWeight) : 0,
          linked: true,
        };
      }
    }

    return {
      compliance: calculateAuditCompliance([item]).compliance,
      linked: false,
    };
  };

  processScoreSessions.forEach((auditSession) => {
    const sessionRoleName = auditSession.role || auditSession.items[0]?.category || "General";
    const effectiveItems = auditSession.items.map((item) => ({
      item,
      effectiveCompliance: getEffectiveItemCompliance(item),
    }));
    const sessionWeight = effectiveItems.reduce((acc, entry) => acc + (entry.item.weight ?? 1), 0);
    const sessionTotal = effectiveItems.reduce((acc, entry) => acc + (entry.effectiveCompliance.compliance * (entry.item.weight ?? 1)), 0);
    const sessionCompliance = {
      compliance: sessionWeight > 0 ? Math.round(sessionTotal / sessionWeight) : 0,
      totalApplicableWeight: sessionWeight,
    };

    const current = areaScoreMetrics.get(sessionRoleName);
    if (!current || sessionCompliance.totalApplicableWeight === 0) {
      return;
    }

    current.total += sessionCompliance.compliance * 100;
    current.weight += 100;
    current.contributions += 1;
    current.linkedItems += effectiveItems.filter((entry) => entry.effectiveCompliance.linked).length;
  });

  processScoreSessions.forEach((auditSession) => {
    auditSession.items.forEach((item) => {
      const legacyLinks = getItemScoreLinks(item).filter((link) => !link.destinationItemId);
      if (legacyLinks.length === 0) {
        return;
      }

      const itemCompliance = calculateAuditCompliance([item]);
      if (itemCompliance.totalApplicableWeight === 0) {
        return;
      }

      legacyLinks.forEach((link) => {
        const current = areaScoreMetrics.get(link.area);
        if (!current) {
          return;
        }

        current.total += itemCompliance.compliance * link.weight;
        current.weight += link.weight;
        current.linkedItems += 1;
        current.contributions += 1;
      });
    });
  });

  const areaScoreRows = Array.from(areaScoreMetrics.entries())
  .map(([role, metrics]) => ({
      role,
      average: metrics.weight > 0 ? Math.round(metrics.total / metrics.weight) : null,
      evaluations: metrics.contributions,
      linkedItems: metrics.linkedItems,
    }))
    .sort((left, right) => {
      if (left.average === null && right.average === null) {
        return left.role.localeCompare(right.role);
      }
      if (left.average === null) {
        return 1;
      }
      if (right.average === null) {
        return -1;
      }
      return right.average - left.average;
    });

  const technicianReviewSessions = processScoreSessions
    .filter((auditSession) => {
      const roleName = auditSession.role || auditSession.items[0]?.category || "";
      return roleName === "T?cnicos" && Boolean(auditSession.staffName?.trim());
    })
    .sort((left, right) => `${right.date}-${right.id}`.localeCompare(`${left.date}-${left.id}`))
    .reduce((acc, auditSession) => {
      const staffName = auditSession.staffName?.trim();
      if (!staffName || acc.some((sessionItem) => sessionItem.staffName?.trim() === staffName)) {
        return acc;
      }

      acc.push(auditSession);
      return acc;
    }, [] as AuditSession[]);

  return {
    sampledOrdersAdvisorProgress,
    completedOrdersAdvisorsCount,
    sampledOrdersProgress,
    sampledServiceAdvisorProgress,
    completedServiceAdvisorTargetsCount,
    sampledServiceAdvisorClientsProgress,
    blendedServiceAdvisorScoreRows,
    blendedTechnicianScoreRows,
    areaScoreRows,
    technicianReviewSessions,
  };
}

