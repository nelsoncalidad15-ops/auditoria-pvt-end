import { AuditItem, AuditPersonScore, AuditRoleScore, AuditSession, AuditTemplateItem, OrResponsibleRole } from "../types";

function normalizeWeight(value?: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 1;
}

function isCalculatedScore(item: Pick<AuditItem, "calculatedScore">) {
  return typeof item.calculatedScore === "number" && Number.isFinite(item.calculatedScore);
}

function isApplicableItem(item: Pick<AuditItem, "status" | "calculatedScore">) {
  return isCalculatedScore(item) || item.status === "pass" || item.status === "fail";
}

export function calculateAuditCompliance(items: AuditItem[]) {
  const applicableItems = items.filter(isApplicableItem);
  const obtainedWeight = applicableItems.reduce((acc, item) => {
    const weight = normalizeWeight(item.weight);
    if (isCalculatedScore(item)) {
      return acc + (weight * Math.max(0, Math.min(100, item.calculatedScore || 0))) / 100;
    }
    return acc + (item.status === "pass" ? weight : 0);
  }, 0);
  const totalApplicableWeight = applicableItems.reduce((acc, item) => acc + normalizeWeight(item.weight), 0);

  return {
    obtainedWeight,
    totalApplicableWeight,
    compliance: totalApplicableWeight > 0 ? Math.round((obtainedWeight / totalApplicableWeight) * 100) : 0,
    itemsCount: applicableItems.length,
  };
}

export function getEffectiveResponsibleRoles(
  item: Pick<AuditItem, "id" | "question" | "responsibleRoles">,
  templateItems?: AuditTemplateItem[]
): OrResponsibleRole[] {
  if (templateItems && templateItems.length > 0) {
    const template = templateItems.find((t) => t.id === item.id || t.text === item.question);
    if (template && Array.isArray(template.responsibleRoles)) {
      return template.responsibleRoles;
    }
  }
  return Array.isArray(item.responsibleRoles) ? item.responsibleRoles : [];
}

export function calculateRoleScores(
  items: AuditItem[],
  impactSharedItemsOnAllRoles = true,
  templateItems?: AuditTemplateItem[]
): AuditRoleScore[] {
  const roleMetrics = new Map<OrResponsibleRole, { obtainedWeight: number; totalApplicableWeight: number; itemsCount: number }>();

  items.forEach((item) => {
    const responsibleRoles = getEffectiveResponsibleRoles(item, templateItems);
    const applicableRoles = impactSharedItemsOnAllRoles ? responsibleRoles : responsibleRoles.slice(0, 1);

    applicableRoles.forEach((role) => {
      if (!isApplicableItem(item)) {
        return;
      }
      const current = roleMetrics.get(role) ?? { obtainedWeight: 0, totalApplicableWeight: 0, itemsCount: 0 };
      current.totalApplicableWeight += normalizeWeight(item.weight);
      current.itemsCount += 1;
      if (isCalculatedScore(item)) {
        current.obtainedWeight += normalizeWeight(item.weight) * Math.max(0, Math.min(100, item.calculatedScore || 0)) / 100;
      } else if (item.status === "pass") {
        current.obtainedWeight += normalizeWeight(item.weight);
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

export interface CampaignRoleDeviation {
  order: string;
  advisor: string;
  question: string;
  note: string;
  photoUrl?: string;
}

export interface CampaignRoleMetric {
  role: OrResponsibleRole;
  label: string;
  totalApplicableWeight: number;
  obtainedWeight: number;
  applicableControls: number;
  compliantControls: number;
  deviationsCount: number;
  compliance: number | null; // null representa "Sin evaluación"
  deviations: CampaignRoleDeviation[];
}

export const CAMPAIGN_ROLES_ORDER: OrResponsibleRole[] = [
  "asesor",
  "tecnico",
  "controller",
  "repuestos",
  "lavador",
];

export const CAMPAIGN_ROLE_LABELS: Record<OrResponsibleRole, string> = {
  asesor: "Asesor de servicio",
  tecnico: "Técnico",
  controller: "Control de calidad",
  repuestos: "Repuestos",
  lavador: "Lavado",
};

export function calculateCampaignRoleMetrics(
  audits: AuditSession[],
  templateItems?: AuditTemplateItem[]
): CampaignRoleMetric[] {
  const metricsMap = new Map<OrResponsibleRole, {
    totalApplicableWeight: number;
    obtainedWeight: number;
    applicableControls: number;
    compliantControls: number;
    deviationsCount: number;
    deviations: CampaignRoleDeviation[];
  }>();

  CAMPAIGN_ROLES_ORDER.forEach((role) => {
    metricsMap.set(role, {
      totalApplicableWeight: 0,
      obtainedWeight: 0,
      applicableControls: 0,
      compliantControls: 0,
      deviationsCount: 0,
      deviations: [],
    });
  });

  audits.forEach((audit) => {
    const advisorName = audit.staffName || audit.participants?.asesorServicio || "Sin asignar";
    const orderNumber = audit.orderNumber || "Sin número";

    (audit.items || []).forEach((item) => {
      const responsibleRoles = getEffectiveResponsibleRoles(item, templateItems);
      if (responsibleRoles.length === 0 || !isApplicableItem(item)) {
        return;
      }

      const weight = normalizeWeight(item.weight);

      responsibleRoles.forEach((role) => {
        let metric = metricsMap.get(role);
        if (!metric) {
          metric = {
            totalApplicableWeight: 0,
            obtainedWeight: 0,
            applicableControls: 0,
            compliantControls: 0,
            deviationsCount: 0,
            deviations: [],
          };
          metricsMap.set(role, metric);
        }

        metric.totalApplicableWeight += weight;
        metric.applicableControls += 1;

        if (isCalculatedScore(item)) {
          const score = Math.max(0, Math.min(100, item.calculatedScore || 0));
          metric.obtainedWeight += (weight * score) / 100;
          if (score >= 100) {
            metric.compliantControls += 1;
          } else {
            metric.deviationsCount += 1;
            metric.deviations.push({
              order: orderNumber,
              advisor: advisorName,
              question: item.question,
              note: item.comment?.trim() || `Puntaje calculado: ${score}%`,
              photoUrl: item.photoUrl,
            });
          }
        } else if (item.status === "pass") {
          metric.obtainedWeight += weight;
          metric.compliantControls += 1;
        } else if (item.status === "fail") {
          metric.deviationsCount += 1;
          metric.deviations.push({
            order: orderNumber,
            advisor: advisorName,
            question: item.question,
            note: item.comment?.trim() || (item.photoUrl ? "Evidencia fotográfica adjunta" : "Sin nota"),
            photoUrl: item.photoUrl,
          });
        }
      });
    });
  });

  return CAMPAIGN_ROLES_ORDER.map((role) => {
    const data = metricsMap.get(role)!;
    const compliance = data.totalApplicableWeight > 0
      ? Math.round((data.obtainedWeight / data.totalApplicableWeight) * 100)
      : null;

    return {
      role,
      label: CAMPAIGN_ROLE_LABELS[role] || role,
      totalApplicableWeight: data.totalApplicableWeight,
      obtainedWeight: data.obtainedWeight,
      applicableControls: data.applicableControls,
      compliantControls: data.compliantControls,
      deviationsCount: data.deviationsCount,
      compliance,
      deviations: data.deviations,
    };
  });
}

export function buildOrderAuditItems(templateItems: AuditTemplateItem[], currentItems: AuditItem[], selectedRoleLabel: string): AuditItem[] {
  return templateItems.map((templateItem) => {
    const existingItem = currentItems.find((item) => item.id === templateItem.id || item.question === templateItem.text);

    return {
      id: templateItem.id,
      question: templateItem.text,
      category: selectedRoleLabel,
      status: existingItem?.status,
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
