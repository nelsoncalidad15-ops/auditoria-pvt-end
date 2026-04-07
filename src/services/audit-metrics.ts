import { calculatePersonScores } from "./or-audit";
import { AuditCategory, AuditSession } from "../types";

export interface AdvisorSamplingProgressItem {
  advisorName: string;
  sampledCount: number;
}

export interface BlendedServiceAdvisorScoreRow {
  personName: string;
  compliance: number;
  evaluations: number;
  areas: string[];
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
      };
    })
    .sort((left, right) => right.compliance - left.compliance);

  const technicianScoreRows = calculatePersonScores(processOrdersSessions, "tecnico", "tecnico");
  const technicianCategoryScoreRows = Array.from(
    processScoreSessions.reduce((acc, auditSession) => {
      const roleName = auditSession.role || auditSession.items[0]?.category || "";
      if (roleName !== "Técnicos") {
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
          typeof metrics.technicianScore === "number" ? "Técnicos" : null,
        ].filter((value): value is string => Boolean(value)),
        evaluations: metrics.evaluations,
      };
    })
    .sort((left, right) => right.compliance - left.compliance);

  const areaScoreRows = auditCategories
    .map((category) => {
      const categorySessions = processScoreSessions.filter((auditSession) => {
        const roleName = auditSession.role || auditSession.items[0]?.category || "General";
        return roleName === category.name;
      });

      if (categorySessions.length === 0) {
        return {
          role: category.name,
          average: null as number | null,
          evaluations: 0,
        };
      }

      const total = categorySessions.reduce((acc, auditSession) => acc + (auditSession.totalScore || 0), 0);
      return {
        role: category.name,
        average: Math.round(total / categorySessions.length),
        evaluations: categorySessions.length,
      };
    })
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
      return roleName === "Técnicos" && Boolean(auditSession.staffName?.trim());
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
