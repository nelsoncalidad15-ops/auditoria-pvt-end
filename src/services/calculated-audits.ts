import { AuditCategory, AuditItem, AuditSession, CalculationRule, CalculatedItemResult, CalculatedItemSource, ProcessDefinition, ProcessResult } from "../types";

function normalizeLabel(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es-AR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isSameCycle(source: Pick<AuditSession, "auditBatchName" | "date" | "location">, candidate: AuditSession) {
  if (source.auditBatchName?.trim()) {
    return candidate.auditBatchName?.trim() === source.auditBatchName.trim()
      && candidate.location === source.location;
  }

  return candidate.location === source.location
    && Boolean(source.date)
    && candidate.date?.slice(0, 7) === source.date.slice(0, 7);
}

function isAfter(left: AuditSession, right: AuditSession) {
  return `${left.date}-${left.id}`.localeCompare(`${right.date}-${right.id}`) > 0;
}

function getItemScore(item: AuditItem | undefined) {
  if (!item) return null;
  if (typeof item.calculatedScore === "number" && Number.isFinite(item.calculatedScore)) {
    return Math.max(0, Math.min(100, item.calculatedScore));
  }
  if (item.status === "pass") return 100;
  if (item.status === "fail") return 0;
  return null;
}

function getSourceSessions({
  session,
  history,
  sourceArea,
}: {
  session: Pick<AuditSession, "auditBatchName" | "date" | "location">;
  history: AuditSession[];
  sourceArea: string;
}) {
  return history.filter((candidate) => (
    isSameCycle(session, candidate)
    && normalizeLabel(candidate.role || candidate.items[0]?.category) === normalizeLabel(sourceArea)
  ));
}

function buildQuestionRuleResult({
  rule,
  session,
  history,
  categories,
}: {
  rule: CalculationRule;
  session: Pick<AuditSession, "auditBatchName" | "date" | "location">;
  history: AuditSession[];
  categories: AuditCategory[];
}) {
  const sourceCategory = categories.find((category) => normalizeLabel(category.name) === normalizeLabel(rule.sourceArea));
  const expectedNames = sourceCategory?.staffOptions.filter(Boolean) ?? [];
  const latestByStaff = new Map<string, AuditSession>();

  getSourceSessions({ session, history, sourceArea: rule.sourceArea || "" }).forEach((sourceSession) => {
    const staffName = sourceSession.staffName?.trim();
    if (!staffName) return;
    const key = normalizeLabel(staffName);
    const previous = latestByStaff.get(key);
    if (!previous || isAfter(sourceSession, previous)) {
      latestByStaff.set(key, sourceSession);
    }
  });

  const orderedNames = expectedNames.length > 0
    ? expectedNames
    : Array.from(latestByStaff.values()).map((sourceSession) => sourceSession.staffName || "Sin colaborador");
  const sources: CalculatedItemSource[] = orderedNames.map((name) => {
    const sourceSession = latestByStaff.get(normalizeLabel(name));
    const sourceItem = sourceSession?.items.find((item) => item.id === rule.sourceItemId);
    if (!sourceSession || !sourceItem) return { name, score: null, status: "pending" };
    if (sourceItem.status === "na") return { name, score: null, status: "na" };
    const score = getItemScore(sourceItem);
    return score === null ? { name, score: null, status: "pending" } : { name, score, status: "answered" };
  });

  const coveredCount = sources.filter((source) => source.status !== "pending").length;
  const expectedCount = Math.max(orderedNames.length, 1);
  const applicable = sources.filter((source) => source.status === "answered" && source.score !== null);
  const score = applicable.length > 0
    ? applicable.reduce((total, source) => total + (source.score || 0), 0) / applicable.length
    : null;
  const coverage = Math.round((coveredCount / expectedCount) * 100);

  return { sources, score, coverage, coveredCount, expectedCount, applicableCount: applicable.length };
}

function buildOrRoleRuleResult({
  rule,
  session,
  history,
  categories,
}: {
  rule: CalculationRule;
  session: Pick<AuditSession, "auditBatchName" | "date" | "location">;
  history: AuditSession[];
  categories: AuditCategory[];
}) {
  const participantFieldByRole = {
    asesor: "asesorServicio",
    tecnico: "tecnico",
    controller: "controller",
    lavador: "lavador",
    repuestos: "repuestos",
  } as const;
  const sourceRole = rule.sourceRole;
  const participantField = sourceRole ? participantFieldByRole[sourceRole] : undefined;
  const sourceCategory = categories.find((category) => normalizeLabel(category.name) === normalizeLabel(rule.sourceArea));
  const expectedNames = sourceCategory?.staffOptions.filter(Boolean) ?? [];
  const scoresByStaff = new Map<string, { name: string; scores: number[] }>();

  history.filter((candidate) => (
    isSameCycle(session, candidate)
    && (candidate.entityType === "or" || normalizeLabel(candidate.role).includes("orden"))
  )).forEach((orderAudit) => {
    if (!sourceRole || !participantField) return;
    const staffName = orderAudit.participants?.[participantField]?.trim();
    if (!staffName) return;
    const applicableItems = orderAudit.items.filter((item) => (
      item.responsibleRoles?.includes(sourceRole)
      && (item.status === "pass" || item.status === "fail")
    ));
    const totalWeight = applicableItems.reduce((total, item) => total + (item.weight ?? 1), 0);
    if (totalWeight === 0) return;
    const obtainedWeight = applicableItems.reduce((total, item) => total + (item.status === "pass" ? (item.weight ?? 1) : 0), 0);
    const key = normalizeLabel(staffName);
    const current = scoresByStaff.get(key) ?? { name: staffName, scores: [] };
    current.scores.push((obtainedWeight / totalWeight) * 100);
    scoresByStaff.set(key, current);
  });

  const orderedNames = expectedNames.length > 0
    ? expectedNames
    : Array.from(scoresByStaff.values()).map((entry) => entry.name);
  const sources: CalculatedItemSource[] = orderedNames.map((name) => {
    const entry = scoresByStaff.get(normalizeLabel(name));
    if (!entry?.scores.length) return { name, score: null, status: "pending" };
    return {
      name,
      score: entry.scores.reduce((total, score) => total + score, 0) / entry.scores.length,
      status: "answered",
    };
  });
  const coveredCount = sources.filter((source) => source.status === "answered").length;
  const expectedCount = Math.max(orderedNames.length, 1);
  const applicable = sources.filter((source) => source.score !== null);
  const score = applicable.length > 0
    ? applicable.reduce((total, source) => total + (source.score || 0), 0) / applicable.length
    : null;

  return {
    sources,
    score,
    coverage: Math.round((coveredCount / expectedCount) * 100),
    coveredCount,
    expectedCount,
    applicableCount: applicable.length,
  };
}
const participantFieldByRole = {
  asesor: "asesorServicio",
  tecnico: "tecnico",
  controller: "controller",
  lavador: "lavador",
  repuestos: "repuestos",
} as const;

function isOrderAudit(audit: AuditSession) {
  return audit.entityType === "or" || normalizeLabel(audit.role).includes("orden");
}

function buildOrQuestionRuleResult({
  rule,
  session,
  history,
  categories,
}: {
  rule: CalculationRule;
  session: Pick<AuditSession, "auditBatchName" | "date" | "location">;
  history: AuditSession[];
  categories: AuditCategory[];
}) {
  const orderAudits = history.filter((audit) => isSameCycle(session, audit) && isOrderAudit(audit));
  const sourceRole = rule.sourceRole;
  const participantField = sourceRole ? participantFieldByRole[sourceRole] : undefined;

  if (!sourceRole || !participantField) {
    const sources = orderAudits.map((audit, index): CalculatedItemSource => {
      const item = audit.items.find((candidate) => candidate.id === rule.sourceItemId);
      const name = audit.orderNumber?.trim() ? `OR ${audit.orderNumber}` : `OR ${index + 1}`;
      if (!item) return { name, score: null, status: "pending" };
      if (item.status === "na") return { name, score: null, status: "na" };
      const score = getItemScore(item);
      return score === null ? { name, score: null, status: "pending" } : { name, score, status: "answered" };
    });
    const coveredCount = sources.filter((source) => source.status !== "pending").length;
    const expectedCount = Math.max(sources.length, 1);
    const applicable = sources.filter((source) => source.status === "answered" && source.score !== null);
    return {
      sources,
      score: applicable.length > 0 ? applicable.reduce((total, source) => total + (source.score || 0), 0) / applicable.length : null,
      coverage: Math.round((coveredCount / expectedCount) * 100),
      coveredCount,
      expectedCount,
      applicableCount: applicable.length,
    };
  }

  const sourceCategory = categories.find((category) => normalizeLabel(category.name) === normalizeLabel(rule.sourceArea));
  const expectedNames = sourceCategory?.staffOptions.filter(Boolean) ?? [];
  const resultsByStaff = new Map<string, { name: string; scores: number[]; hasNa: boolean }>();

  orderAudits.forEach((audit) => {
    const name = audit.participants?.[participantField]?.trim();
    if (!name) return;
    const item = audit.items.find((candidate) => candidate.id === rule.sourceItemId);
    if (!item) return;
    const key = normalizeLabel(name);
    const current = resultsByStaff.get(key) ?? { name, scores: [], hasNa: false };
    if (item.status === "na") {
      current.hasNa = true;
    } else {
      const score = getItemScore(item);
      if (score !== null) current.scores.push(score);
    }
    resultsByStaff.set(key, current);
  });

  const orderedNames = expectedNames.length > 0
    ? expectedNames
    : Array.from(resultsByStaff.values()).map((entry) => entry.name);
  const sources: CalculatedItemSource[] = orderedNames.map((name) => {
    const entry = resultsByStaff.get(normalizeLabel(name));
    if (!entry) return { name, score: null, status: "pending" };
    if (entry.scores.length > 0) {
      return {
        name,
        score: entry.scores.reduce((total, score) => total + score, 0) / entry.scores.length,
        status: "answered",
      };
    }
    return entry.hasNa ? { name, score: null, status: "na" } : { name, score: null, status: "pending" };
  });
  const coveredCount = sources.filter((source) => source.status !== "pending").length;
  const expectedCount = Math.max(orderedNames.length, 1);
  const applicable = sources.filter((source) => source.status === "answered" && source.score !== null);
  return {
    sources,
    score: applicable.length > 0 ? applicable.reduce((total, source) => total + (source.score || 0), 0) / applicable.length : null,
    coverage: Math.round((coveredCount / expectedCount) * 100),
    coveredCount,
    expectedCount,
    applicableCount: applicable.length,
  };
}

function buildOrTotalRuleResult({
  session,
  history,
}: {
  session: Pick<AuditSession, "auditBatchName" | "date" | "location">;
  history: AuditSession[];
}) {
  const orderAudits = history.filter((audit) => isSameCycle(session, audit) && isOrderAudit(audit));
  const sources: CalculatedItemSource[] = orderAudits.map((audit, index) => ({
    name: audit.orderNumber?.trim() ? `OR ${audit.orderNumber}` : `OR ${index + 1}`,
    score: Number.isFinite(audit.totalScore) ? audit.totalScore : null,
    status: Number.isFinite(audit.totalScore) ? "answered" : "pending",
  }));
  const coveredCount = sources.filter((source) => source.status === "answered").length;
  const expectedCount = Math.max(sources.length, 1);
  const applicable = sources.filter((source) => source.score !== null);
  return {
    sources,
    score: applicable.length > 0 ? applicable.reduce((total, source) => total + (source.score || 0), 0) / applicable.length : null,
    coverage: Math.round((coveredCount / expectedCount) * 100),
    coveredCount,
    expectedCount,
    applicableCount: applicable.length,
  };
}

function isRuleSourceConfigured(rule: CalculationRule) {
  if (rule.sourceType === "or_role") return Boolean(rule.sourceRole);
  if (rule.sourceType === "or_total") return true;
  if (rule.sourceType === "or_question") return Boolean(rule.sourceItemId);
  return Boolean(rule.sourceArea && rule.sourceItemId);
}

function getEffectiveSessionScore({
  audit,
  category,
  history,
  categories,
  rules,
}: {
  audit: AuditSession;
  category?: AuditCategory;
  history: AuditSession[];
  categories: AuditCategory[];
  rules: CalculationRule[];
}) {
  const calculatedTemplates = category?.items.filter((item) => item.calculationMode === "calculated") ?? [];
  if (!category || calculatedTemplates.length === 0) {
    return { score: audit.totalScore, calculationComplete: true };
  }

  const calculationResults = buildCalculatedItemResults({
    session: { ...audit, role: audit.role || category.name },
    history,
    categories,
    rules,
  });
  const templatesById = new Map(category.items.map((item) => [item.id, item]));
  let totalWeight = 0;
  let obtainedWeight = 0;

  audit.items.forEach((item) => {
    const template = templatesById.get(item.id);
    if (template?.calculationMode === "calculated" || item.status === "calculated") return;
    const score = getItemScore(item);
    if (score === null) return;
    const weight = item.weight ?? template?.weight ?? 1;
    totalWeight += weight;
    obtainedWeight += (score / 100) * weight;
  });

  let calculationComplete = true;
  calculatedTemplates.forEach((template) => {
    const result = calculationResults[template.id];
    if (typeof result?.score !== "number") {
      calculationComplete = false;
      return;
    }
    const weight = template.weight ?? 1;
    totalWeight += weight;
    obtainedWeight += (result.score / 100) * weight;
    if (result.state !== "complete") {
      calculationComplete = false;
    }
  });

  return {
    score: totalWeight > 0 ? (obtainedWeight / totalWeight) * 100 : null,
    calculationComplete,
  };
}

function getAreaCycleScore({
  area,
  session,
  history,
  categories,
  rules,
}: {
  area: string;
  session: Pick<AuditSession, "auditBatchName" | "date" | "location">;
  history: AuditSession[];
  categories: AuditCategory[];
  rules: CalculationRule[];
}) {
  const category = categories.find((item) => normalizeLabel(item.name) === normalizeLabel(area));
  const expectedNames = category?.staffOptions.filter(Boolean) ?? [];
  const latestByStaff = new Map<string, AuditSession>();
  const matchingSessions = history.filter((candidate) => (
    isSameCycle(session, candidate)
    && normalizeLabel(candidate.role || candidate.items[0]?.category) === normalizeLabel(area)
  ));

  matchingSessions.forEach((candidate) => {
    const name = candidate.staffName?.trim() || "__single__";
    const key = normalizeLabel(name);
    const previous = latestByStaff.get(key);
    if (!previous || isAfter(candidate, previous)) {
      latestByStaff.set(key, candidate);
    }
  });

  const orderedNames = expectedNames.length > 0
    ? expectedNames
    : Array.from(latestByStaff.values()).map((candidate) => candidate.staffName || area);
  const scores = orderedNames.map((name) => {
    const audit = latestByStaff.get(normalizeLabel(name));
    if (!audit) return { score: null, calculationComplete: true };
    return getEffectiveSessionScore({ audit, category, history, categories, rules });
  });
  const applicableScores = scores.filter((entry): entry is { score: number; calculationComplete: boolean } => (
    typeof entry.score === "number" && Number.isFinite(entry.score)
  ));

  return {
    score: applicableScores.length > 0 ? applicableScores.reduce((total, entry) => total + entry.score, 0) / applicableScores.length : null,
    covered: applicableScores.length,
    expected: Math.max(orderedNames.length, 1),
    calculationComplete: applicableScores.every((entry) => entry.calculationComplete),
  };
}

export function buildProcessResults({
  session,
  history,
  categories,
  definitions,
  rules,
}: {
  session: Pick<AuditSession, "auditBatchName" | "date" | "location">;
  history: AuditSession[];
  categories: AuditCategory[];
  definitions: ProcessDefinition[];
  rules: CalculationRule[];
}): ProcessResult[] {
  return definitions
    .filter((definition) => definition.active)
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name))
    .map((definition) => {
      const areaScores = definition.areas.map((area) => ({
        area,
        ...getAreaCycleScore({ area, session, history, categories, rules }),
      }));
      const scoredAreas = areaScores.filter((entry) => entry.score !== null);
      const totalWeight = scoredAreas.reduce((total, entry) => {
        const index = definition.areas.indexOf(entry.area);
        return total + Math.max(0.01, definition.weights[index] ?? 1);
      }, 0);
      const score = totalWeight > 0
        ? scoredAreas.reduce((total, entry) => {
            const index = definition.areas.indexOf(entry.area);
            return total + (entry.score || 0) * Math.max(0.01, definition.weights[index] ?? 1);
          }, 0) / totalWeight
        : null;
      const coveredAreas = scoredAreas.length;
      const totalAreas = Math.max(definition.areas.length, 1);
      const coverage = Math.round((coveredAreas / totalAreas) * 100);
      const calculationComplete = areaScores.every((entry) => entry.calculationComplete);
      const state = score === null
        ? "pending"
        : coverage >= definition.minimumCoverage && calculationComplete ? "complete" : "provisional";

      return {
        id: definition.id,
        name: definition.name,
        score: score === null ? null : Math.round(score * 10) / 10,
        state,
        coveredAreas,
        totalAreas,
        minimumCoverage: definition.minimumCoverage,
        areaScores: areaScores.map((entry) => ({ area: entry.area, score: entry.score === null ? null : Math.round(entry.score * 10) / 10 })),
      };
    });
}

export function buildCalculatedItemResults({
  session,
  history,
  categories,
  rules,
}: {
  session: Pick<AuditSession, "auditBatchName" | "date" | "location" | "role">;
  history: AuditSession[];
  categories: AuditCategory[];
  rules: CalculationRule[];
}): Record<string, CalculatedItemResult> {
  const applicableRules = rules.filter((rule) => (
    rule.active
    && normalizeLabel(rule.targetArea) === normalizeLabel(session.role)
    && isRuleSourceConfigured(rule)
  ));
  const rulesByTarget = applicableRules.reduce((acc, rule) => {
    const current = acc.get(rule.targetItemId) ?? [];
    current.push(rule);
    acc.set(rule.targetItemId, current);
    return acc;
  }, new Map<string, CalculationRule[]>());

  return Array.from(rulesByTarget.entries()).reduce((results, [itemId, targetRules]) => {
    const ruleResults = targetRules.map((rule) => ({
      rule,
      result: rule.sourceType === "or_role"
        ? buildOrRoleRuleResult({ rule, session, history, categories })
        : rule.sourceType === "or_question"
          ? buildOrQuestionRuleResult({ rule, session, history, categories })
          : rule.sourceType === "or_total"
            ? buildOrTotalRuleResult({ session, history })
            : buildQuestionRuleResult({ rule, session, history, categories }),
    }));
    const scored = ruleResults.filter((entry) => entry.result.score !== null);
    const totalWeight = scored.reduce((total, entry) => total + Math.max(0.01, entry.rule.sourceWeight || 1), 0);
    const score = totalWeight > 0
      ? scored.reduce((total, entry) => total + (entry.result.score || 0) * Math.max(0.01, entry.rule.sourceWeight || 1), 0) / totalWeight
      : null;
    const minimumCoverage = Math.max(...targetRules.map((rule) => Math.max(0, Math.min(100, rule.minimumCoverage))), 0);
    const coverage = Math.min(...ruleResults.map((entry) => entry.result.coverage));
    const coveredCount = ruleResults.reduce((total, entry) => total + entry.result.coveredCount, 0);
    const expectedCount = ruleResults.reduce((total, entry) => total + entry.result.expectedCount, 0);
    const applicableCount = ruleResults.reduce((total, entry) => total + entry.result.applicableCount, 0);
    const sources = ruleResults.flatMap((entry) => entry.result.sources);
    const state = score === null
      ? (coveredCount > 0 ? "not_applicable" : "pending")
      : coverage >= minimumCoverage ? "complete" : "provisional";
    const roundedScore = score === null ? null : Math.round(score);
    const detail = state === "pending"
      ? `Pendiente: ${coveredCount} de ${expectedCount} colaboradores auditados`
      : state === "not_applicable"
        ? `Sin dato aplicable: ${coveredCount} de ${expectedCount} colaboradores auditados`
        : `${roundedScore}% calculado · cobertura ${coveredCount} de ${expectedCount}`;

    results[itemId] = {
      itemId,
      score: score === null ? null : Math.round(score * 10) / 10,
      state,
      coverage,
      coveredCount,
      expectedCount,
      applicableCount,
      minimumCoverage,
      detail,
      sources,
    };
    return results;
  }, {} as Record<string, CalculatedItemResult>);
}
