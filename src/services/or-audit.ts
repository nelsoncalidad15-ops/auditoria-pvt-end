import { AuditItem, AuditPersonScore, AuditRoleScore, AuditSession, AuditTemplateItem, OrResponsibleRole } from "../types";

function normalizeWeight(value?: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 1;
}

function isApplicableItem(item: Pick<AuditItem, "status">) {
  return item.status !== "na";
}

export function calculateAuditCompliance(items: AuditItem[]) {
  const applicableItems = items.filter(isApplicableItem);
  const obtainedWeight = applicableItems.reduce((acc, item) => acc + (item.status === "pass" ? normalizeWeight(item.weight) : 0), 0);
  const totalApplicableWeight = applicableItems.reduce((acc, item) => acc + normalizeWeight(item.weight), 0);

  return {
    obtainedWeight,
    totalApplicableWeight,
    compliance: totalApplicableWeight > 0 ? Math.round((obtainedWeight / totalApplicableWeight) * 100) : 0,
    itemsCount: applicableItems.length,
  };
}

export function calculateRoleScores(items: AuditItem[], impactSharedItemsOnAllRoles = true): AuditRoleScore[] {
  const roleMetrics = new Map<OrResponsibleRole, { obtainedWeight: number; totalApplicableWeight: number; itemsCount: number }>();

  items.forEach((item) => {
    const responsibleRoles = Array.isArray(item.responsibleRoles) ? item.responsibleRoles : [];
    const applicableRoles = impactSharedItemsOnAllRoles ? responsibleRoles : responsibleRoles.slice(0, 1);

    applicableRoles.forEach((role) => {
      const current = roleMetrics.get(role) ?? { obtainedWeight: 0, totalApplicableWeight: 0, itemsCount: 0 };
      if (item.status !== "na") {
        current.totalApplicableWeight += normalizeWeight(item.weight);
        current.itemsCount += 1;
        if (item.status === "pass") {
          current.obtainedWeight += normalizeWeight(item.weight);
        }
      }
      roleMetrics.set(role, current);
    });
  });

  return Array.from(roleMetrics.entries()).map(([role, metrics]) => ({
    role,
    obtainedWeight: metrics.obtainedWeight,
    totalApplicableWeight: metrics.totalApplicableWeight,
    itemsCount: metrics.itemsCount,
    compliance: metrics.totalApplicableWeight > 0 ? Math.round((metrics.obtainedWeight / metrics.totalApplicableWeight) * 100) : 0,
  }));
}

export function buildOrderAuditItems(templateItems: AuditTemplateItem[], currentItems: AuditItem[], selectedRoleLabel: string): AuditItem[] {
  return templateItems.map((templateItem) => {
    const existingItem = currentItems.find((item) => item.id === templateItem.id || item.question === templateItem.text);

    return {
      id: templateItem.id,
      question: templateItem.text,
      category: selectedRoleLabel,
      status: existingItem?.status ?? "na",
      comment: existingItem?.comment ?? "",
      photoUrl: existingItem?.photoUrl,
      description: templateItem.description ?? existingItem?.description ?? "",
      responsibleRoles: templateItem.responsibleRoles ?? existingItem?.responsibleRoles ?? [],
      sector: templateItem.sector ?? existingItem?.sector,
      weight: normalizeWeight(templateItem.weight ?? existingItem?.weight),
      allowsNa: typeof templateItem.allowsNa === "boolean" ? templateItem.allowsNa : existingItem?.allowsNa ?? true,
      evidenceComment: existingItem?.evidenceComment ?? "",
      scoreLinks: Array.isArray(templateItem.scoreLinks) ? templateItem.scoreLinks : existingItem?.scoreLinks ?? [],
      scoreAreas: Array.isArray(templateItem.scoreLinks)
        ? templateItem.scoreLinks.map((link) => link.area)
        : Array.isArray(existingItem?.scoreLinks)
          ? existingItem.scoreLinks.map((link) => link.area)
          : Array.isArray(templateItem.scoreAreas) ? templateItem.scoreAreas : existingItem?.scoreAreas ?? [],
    };
  });
}

export function calculatePersonScores(history: AuditSession[], role: OrResponsibleRole, participantField: string): AuditPersonScore[] {
  const personMetrics = new Map<string, { total: number; count: number }>();

  history.forEach((session) => {
    const personName = (session.participants as Record<string, string | undefined> | undefined)?.[participantField]?.trim();
    const roleScore = session.roleScores?.find((item) => item.role === role);

    if (!personName || !roleScore || roleScore.totalApplicableWeight === 0) {
      return;
    }

    const current = personMetrics.get(personName) ?? { total: 0, count: 0 };
    current.total += roleScore.compliance;
    current.count += 1;
    personMetrics.set(personName, current);
  });

  return Array.from(personMetrics.entries())
    .map(([personName, metrics]) => ({
      role,
      personName,
      compliance: Math.round(metrics.total / metrics.count),
      evaluations: metrics.count,
    }))
    .sort((left, right) => right.compliance - left.compliance);
}
