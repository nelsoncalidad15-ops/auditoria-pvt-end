import { AuditItem, AuditTemplateItem, Role } from "../types";

export const PRE_DELIVERY_DOCUMENTARY_BLOCK = "Legajo documental (3 planes + 3 tradicional)";

function normalizeWeight(value?: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 1;
}

function buildLegajoQuestionLabel(legajoName: string, question: string) {
  return `${legajoName} ? ${question}`;
}

export function buildPreDeliveryTemplateItems(templateItems: AuditTemplateItem[], auditedFileNames: string[]): AuditTemplateItem[] {
  const normalizedFileNames = auditedFileNames
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 6);

  const documentaryItems = templateItems.filter((item) => item.block === PRE_DELIVERY_DOCUMENTARY_BLOCK);
  const generalItems = templateItems.filter((item) => item.block !== PRE_DELIVERY_DOCUMENTARY_BLOCK);

  const expandedDocumentaryItems = normalizedFileNames.flatMap((legajoName, index) =>
    documentaryItems.map((item) => ({
      ...item,
      id: `pre-delivery-file-${index + 1}-${item.id}`,
      text: buildLegajoQuestionLabel(legajoName, item.text),
      block: `Legajo auditado ${index + 1}: ${legajoName}`,
    }))
  );

  return [...expandedDocumentaryItems, ...generalItems];
}

export function buildPreDeliveryAuditItems(
  templateItems: AuditTemplateItem[],
  currentItems: AuditItem[],
  auditedFileNames: string[],
  selectedRoleLabel: Role,
): AuditItem[] {
  return buildPreDeliveryTemplateItems(templateItems, auditedFileNames).map((templateItem) => {
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

