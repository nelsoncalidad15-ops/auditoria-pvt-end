import { AuditCategory, AuditItem, AuditItemStatus, AuditSession, AuditStructureScope, AuditTemplateItem, CalculationRule, Location, OrAuditSector, OrResponsibleRole, ProcessDefinition } from "../types";

export interface AuditSheetSummaryRow {
  auditId: string;
  submittedAt: string;
  auditDate: string;
  auditBatchName: string;
  sampleTarget: number;
  selectedStaffNames: string;
  location: string;
  auditorId: string;
  auditorName: string;
  role: string;
  staffName: string;
  orderNumber: string;
  totalScore: number;
  passCount: number;
  failCount: number;
  naCount: number;
  answeredCount: number;
  itemsCount: number;
  notes: string;
  submittedByEmail: string;
  asesorServicio: string;
  tecnico: string;
  controller: string;
  lavador: string;
  repuestos: string;
  entityType: string;
}

export interface AuditSheetItemRow {
  auditId: string;
  submittedAt: string;
  auditDate: string;
  auditBatchName: string;
  location: string;
  auditorName: string;
  role: string;
  staffName: string;
  questionIndex: number;
  itemId: string;
  question: string;
  description: string;
  sector: string;
  responsibleRoles: string;
  scoreAreas: string;
  scoreLinks: string;
  weight: number;
  allowsNa: string;
  status: AuditItemStatus;
  statusLabel: string;
  calculatedScore?: number;
  calculationState?: string;
  calculationDetail?: string;
  comment: string;
  photoUrl?: string;
}

export interface AuditSyncPayload {
  event: "audit_submitted";
  version: "1.0";
  submittedAt: string;
  audit: AuditSession & {
    auditorName: string;
    submittedByEmail: string;
  };
  metrics: {
    passCount: number;
    failCount: number;
    naCount: number;
    answeredCount: number;
    itemsCount: number;
  };
  sheet: {
    summaryRow: AuditSheetSummaryRow;
    itemRows: AuditSheetItemRow[];
  };
}

export interface StockControlSheetRow {
  source: string;
  systemLocation: string;
  line: string;
  article: string;
  description: string;
  systemStock: number;
  locationResult: "si" | "no";
  quantityResult: "si" | "no";
  observedLocation: string;
  physicalQuantity: string;
  comment: string;
}

export interface StockControlSyncPayload extends Omit<AuditSyncPayload, "event"> {
  event: "stock_control_submit";
  stockRows: StockControlSheetRow[];
}
interface AuditHistoryResponse {
  ok: boolean;
  summaryRows?: AuditSheetSummaryRow[];
  itemRows?: AuditSheetItemRow[];
  error?: string;
}

interface AuditWebhookResponse {
  ok: boolean;
  auditId?: string;
  uploadedPhotos?: number;
  deletedAuditId?: string;
  deletedSummaryRows?: number;
  deletedItemRows?: number;
  error?: string;
}

const statusLabelMap: Record<AuditSheetItemRow["status"], string> = {
  pass: "Cumple",
  fail: "No Cumple",
  na: "N/A",
  calculated: "Calculado",
};

export function buildAuditSyncPayload(params: { templateItems: AuditTemplateItem[];
  session: AuditSession;
  auditorName: string;
  submittedByEmail?: string | null;
}): AuditSyncPayload {
  const { session, templateItems, auditorName, submittedByEmail } = params;
  const submittedAt = new Date().toISOString();
  
  // Se conserva solamente lo que el auditor respondió. Una pregunta pendiente
  // no es "No aplica" y no debe alterar el puntaje ni el historial.
  const finalItems = session.items
    .filter((item): item is AuditItem & { status: AuditSheetItemRow["status"] } => isAuditStatus(item.status))
    .map((sessionItem) => {
      const template = templateItems.find((item) => item.id === sessionItem.id || item.text === sessionItem.question);

      return {
        ...sessionItem,
        category: sessionItem.category || session.role || "General",
        comment: sessionItem.comment ?? "",
        photoUrl: sessionItem.photoUrl ?? "",
        // La plantilla mantiene sus metadatos como fuente de verdad.
        weight: template?.weight ?? sessionItem.weight ?? 1,
        sector: template?.sector ?? sessionItem.sector,
        responsibleRoles: template?.responsibleRoles ?? sessionItem.responsibleRoles ?? [],
        scoreAreas: template?.scoreAreas ?? sessionItem.scoreAreas ?? [],
        scoreLinks: template?.scoreLinks ?? sessionItem.scoreLinks ?? [],
      };
    });
  const passCount = finalItems.filter((item) => item.status === "pass").length;
  const failCount = finalItems.filter((item) => item.status === "fail").length;
  const naCount = finalItems.filter((item) => item.status === "na").length;
  const answeredCount = finalItems.length;
  const itemsCount = finalItems.length;

  return {
    event: "audit_submitted",
    version: "1.0",
    submittedAt,
    audit: {
      ...session,
      items: finalItems,
      auditorName,
      submittedByEmail: submittedByEmail ?? "",
    },
    metrics: {
      passCount,
      failCount,
      naCount,
      answeredCount,
      itemsCount,
    },
    sheet: {
      summaryRow: {
        auditId: session.id,
        submittedAt,
        auditDate: session.date,
        auditBatchName: session.auditBatchName ?? "",
        sampleTarget: session.sampleTarget ?? 0,
        selectedStaffNames: (session.selectedStaffNames ?? []).join("|") ,
        location: session.location,
        auditorId: session.auditorId,
        auditorName,
        role: session.role ?? "",
        staffName: session.staffName ?? "",
        orderNumber: session.orderNumber ?? "",
        totalScore: session.totalScore,
        passCount,
        failCount,
        naCount,
        answeredCount,
        itemsCount,
        notes: session.notes ?? "",
        submittedByEmail: submittedByEmail ?? "",
        asesorServicio: session.participants?.asesorServicio ?? "",
        tecnico: session.participants?.tecnico ?? "",
        controller: session.participants?.controller ?? "",
        lavador: session.participants?.lavador ?? "",
        repuestos: session.participants?.repuestos ?? "",
        entityType: session.entityType ?? "general",
      },
      itemRows: finalItems.map((item, index) => ({
        auditId: session.id,
        submittedAt,
        auditDate: session.date,
        auditBatchName: session.auditBatchName ?? "",
        location: session.location,
        auditorName,
        role: session.role ?? item.category,
        staffName: session.staffName ?? "",
        questionIndex: index + 1,
        itemId: item.id,
        question: item.question,
        description: item.description ?? "",
        sector: item.sector ?? "",
        responsibleRoles: Array.isArray(item.responsibleRoles) ? item.responsibleRoles.join(",") : "",
        scoreAreas: Array.isArray(item.scoreAreas) ? item.scoreAreas.join(",") : "",
        scoreLinks: Array.isArray(item.scoreLinks)
          ? item.scoreLinks.map((link: any) => [
              encodeURIComponent(link.area),
              link.weight,
              encodeURIComponent(link.destinationItemId || ""),
              encodeURIComponent(link.destinationItemText || ""),
            ].join(":")).join("|")
          : "",
        weight: item.weight ?? 1,
        allowsNa: item.allowsNa === false ? "false" : "true",
        status: item.status,
        statusLabel: statusLabelMap[item.status],
        calculatedScore: item.calculatedScore,
        calculationState: item.calculationState,
        calculationDetail: item.calculationDetail,
        comment: item.comment ?? "",
        photoUrl: item.photoUrl ?? "",
      })),
    },
  };
}

export async function sendAuditToWebhook(webhookUrl: string, payload: AuditSyncPayload) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`No se pudo enviar la auditoría (${response.status}).`);
  }

  const responseText = await response.text();
  let parsedResponse: AuditWebhookResponse;

  try {
    parsedResponse = JSON.parse(responseText) as AuditWebhookResponse;
  } catch {
    throw new Error("Apps Script respondió con un formato inválido.");
  }

  if (!parsedResponse.ok) {
    throw new Error(parsedResponse.error || "Apps Script rechazó la auditoría.");
  }

  return parsedResponse;
}

export async function sendStockControlToWebhook(webhookUrl: string, payload: StockControlSyncPayload) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`No se pudo guardar el control físico (${response.status}).`);
  }

  const responseText = await response.text();
  let parsedResponse: AuditWebhookResponse;
  try {
    parsedResponse = JSON.parse(responseText) as AuditWebhookResponse;
  } catch {
    throw new Error("Apps Script respondió con un formato inválido al guardar el control físico.");
  }

  if (!parsedResponse.ok) {
    throw new Error(parsedResponse.error || "Apps Script rechazó el control físico.");
  }

  return parsedResponse;
}

export async function deleteAuditFromWebhook(webhookUrl: string, auditId: string, options?: { userEmail?: string; reason?: string }) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      event: "audit_delete",
      auditId,
      userEmail: options?.userEmail || "",
      reason: options?.reason || "",
      deletedAt: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`No se pudo eliminar la auditoría en Sheets (${response.status}).`);
  }

  const responseText = await response.text();
  let parsedResponse: AuditWebhookResponse;

  try {
    parsedResponse = JSON.parse(responseText) as AuditWebhookResponse;
  } catch {
    throw new Error("Apps Script respondió con un formato inválido al eliminar.");
  }

  if (!parsedResponse.ok) {
    throw new Error(parsedResponse.error || "Apps Script rechazó la eliminación.");
  }

  return parsedResponse;
}

export async function saveAuditStructureToWebhook(
  webhookUrl: string,
  scope: AuditStructureScope,
  categories: AuditCategory[],
) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      event: "structure_replace",
      scope,
      categories,
    }),
  });

  if (!response.ok) {
    throw new Error(`No se pudo guardar la configuración en Sheets (${response.status}).`);
  }

  const payload = await response.json() as { ok?: boolean; error?: string; categoryCount?: number; itemCount?: number };
  if (!payload.ok) {
    throw new Error(payload.error || "Apps Script rechazó la configuración.");
  }

  return payload;
}
export async function saveCalculationRulesToWebhook(
  webhookUrl: string,
  scope: AuditStructureScope,
  rules: CalculationRule[],
) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      event: "calculation_rules_replace",
      scope,
      rules,
    }),
  });

  if (!response.ok) {
    throw new Error(`No se pudieron guardar las reglas de cálculo en Sheets (${response.status}).`);
  }

  const payload = await response.json() as { ok?: boolean; error?: string; ruleCount?: number };
  if (!payload.ok) {
    throw new Error(payload.error || "Apps Script rechazó las reglas de cálculo.");
  }

  return payload;
}
export async function saveProcessDefinitionsToWebhook(
  webhookUrl: string,
  scope: AuditStructureScope,
  definitions: ProcessDefinition[],
) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      event: "process_definitions_replace",
      scope,
      definitions,
    }),
  });

  if (!response.ok) {
    throw new Error(`No se pudieron guardar los procesos en Sheets (${response.status}).`);
  }

  const payload = await response.json() as { ok?: boolean; error?: string; processCount?: number };
  if (!payload.ok) {
    throw new Error(payload.error || "Apps Script rechazó los procesos.");
  }

  return payload;
}

export interface SheetAuditStructure {
  scopes: Partial<Record<AuditStructureScope, AuditCategory[]>>;
  calculationRules: CalculationRule[];
  processDefinitions: ProcessDefinition[];
}

export async function fetchAuditStructureFromWebhook(
  webhookUrl: string,
): Promise<SheetAuditStructure> {
  const url = new URL(webhookUrl);
  url.searchParams.set("mode", "structure");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`No se pudo leer la configuración de auditoría (${response.status}).`);
  }

  const payload = await response.json() as {
    ok?: boolean;
    error?: string;
    scopes?: Partial<Record<AuditStructureScope, AuditCategory[]>>;
    calculationRules?: CalculationRule[];
    processDefinitions?: ProcessDefinition[];
  };

  if (!payload.ok) {
    throw new Error(payload.error || "Sheets no devolvió una estructura válida.");
  }

  return {
    scopes: payload.scopes ?? {},
    calculationRules: Array.isArray(payload.calculationRules) ? payload.calculationRules : [],
    processDefinitions: Array.isArray(payload.processDefinitions) ? payload.processDefinitions : [],
  };
}function parseNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}


function normalizeLocation(value: string): Location {
  if (value === "Salta" || value === "Jujuy") {
    return value;
  }

  return "Sin ubicación";
}

function isAuditStatus(value: unknown): value is AuditSheetItemRow["status"] {
  return value === "pass" || value === "fail" || value === "na" || value === "calculated";
}

function normalizeStatus(value: string): AuditSheetItemRow["status"] {
  return isAuditStatus(value) ? value : "na";
}

function normalizeSheetItemRow(row: AuditSheetItemRow) {
  const rawStatus = String(row.status || "");
  const shiftedStatus = String(row.responsibleRoles || "");

  if (!isAuditStatus(rawStatus) && isAuditStatus(shiftedStatus)) {
    return {
      ...row,
      description: String(row.status || row.description || ""),
      sector: String(row.statusLabel || row.sector || ""),
      responsibleRoles: String(row.comment || ""),
      scoreAreas: row.scoreAreas || "",
      scoreLinks: row.scoreLinks || "",
      weight: parseNumber(row.description) || parseNumber(row.weight) || 1,
      allowsNa: String(row.sector || row.allowsNa || "true"),
      status: shiftedStatus,
      statusLabel: String(row.weight || statusLabelMap[shiftedStatus]),
      comment: String(row.allowsNa || ""),
      photoUrl: row.photoUrl || undefined,
    };
  }

  return {
    ...row,
    status: normalizeStatus(rawStatus),
  };
}

function normalizeCalculationState(value: unknown): AuditItem["calculationState"] {
  return value === "pending" || value === "provisional" || value === "complete" || value === "not_applicable"
    ? value
    : undefined;
}
function isResponsibleRole(value: string): value is OrResponsibleRole {
  return value === "asesor" || value === "tecnico" || value === "controller" || value === "lavador" || value === "repuestos";
}

function isOrAuditSector(value: string): value is OrAuditSector {
  return value === "recepcion" || value === "taller" || value === "control_calidad" || value === "lavado" || value === "repuestos" || value === "resumen";
}

export async function fetchAuditHistoryFromWebhook(webhookUrl: string): Promise<AuditSession[]> {
  const url = new URL(webhookUrl);
  url.searchParams.set("mode", "history");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`No se pudo obtener el historial externo (${response.status}).`);
  }

  const payload = (await response.json()) as AuditHistoryResponse;
  if (!payload.ok) {
    throw new Error(payload.error || "La fuente externa devolvió una respuesta inválida.");
  }

  const summaryRows = Array.isArray(payload.summaryRows) ? payload.summaryRows : [];
  const itemRows = Array.isArray(payload.itemRows) ? payload.itemRows : [];
  const itemsByAuditId = itemRows.reduce((acc, row) => {
    const auditId = row.auditId?.trim();
    if (!auditId) {
      return acc;
    }

    const current = acc.get(auditId) ?? [];
    const normalizedRow = normalizeSheetItemRow(row);
    current.push({
      ...normalizedRow,
      questionIndex: parseNumber(normalizedRow.questionIndex),
    });
    acc.set(auditId, current);
    return acc;
  }, new Map<string, Array<AuditSheetItemRow & { questionIndex: number }>>());

  return summaryRows
    .filter((row) => Boolean(row.auditId && row.auditDate))
    .map((row) => {
      const location = normalizeLocation(String(row.location || "").trim());

      return {
        id: row.auditId,
        date: row.auditDate,
        auditBatchName: row.auditBatchName || "",
        sampleTarget: parseNumber(row.sampleTarget) || undefined,
        selectedStaffNames: row.selectedStaffNames ? String(row.selectedStaffNames).split("|").map((name) => name.trim()).filter(Boolean) : undefined,
        auditorId: row.auditorId || "",
        location,
        staffName: row.staffName || "",
        orderNumber: row.orderNumber || "",
        role: row.role || "",
        totalScore: parseNumber(row.totalScore),
        notes: row.notes || "",
        participants: {
          asesorServicio: row.asesorServicio || "",
          tecnico: row.tecnico || "",
          controller: row.controller || "",
          lavador: row.lavador || "",
          repuestos: row.repuestos || "",
        },
        entityType: (row.entityType === "or" ? "or" : "general") as "or" | "general",
        source: "sheet" as const,
        items: (itemsByAuditId.get(row.auditId) ?? [])
          .sort((left, right) => left.questionIndex - right.questionIndex)
          .map((itemRow, index) => ({
            id: itemRow.itemId || `${row.auditId}-${index + 1}`,
            question: itemRow.question,
            category: itemRow.role || row.role || "General",
            status: itemRow.status,
            calculatedScore: itemRow.status === "calculated" && String(itemRow.calculatedScore || "").trim() !== "" ? parseNumber(itemRow.calculatedScore) : undefined,
            calculationState: normalizeCalculationState(itemRow.calculationState),
            calculationDetail: itemRow.calculationDetail || undefined,
            comment: itemRow.comment || "",
            description: itemRow.description || "",
            sector: itemRow.sector && isOrAuditSector(itemRow.sector) ? itemRow.sector : undefined,
            responsibleRoles: itemRow.responsibleRoles ? itemRow.responsibleRoles.split(",").filter(isResponsibleRole) : [],
            scoreAreas: itemRow.scoreAreas ? itemRow.scoreAreas.split(",").map((value) => value.trim()).filter(Boolean) : [],
            scoreLinks: itemRow.scoreLinks
              ? itemRow.scoreLinks.split("|").map((entry) => {
                  const [area, weight, destinationItemId, destinationItemText] = entry.split(":");
                  return {
                    area: area?.trim() ?? "",
                    weight: parseNumber(weight) || 0,
                    destinationItemId: destinationItemId?.trim() ?? "",
                    destinationItemText: destinationItemText?.trim() ?? "",
                  };
                }).map((link) => ({
                  ...link,
                  area: decodeURIComponent(link.area),
                  destinationItemId: decodeURIComponent(link.destinationItemId || ""),
                  destinationItemText: decodeURIComponent(link.destinationItemText || ""),
                })).filter((link) => Boolean(link.area) && link.weight > 0)
              : undefined,
            weight: parseNumber(itemRow.weight) || 1,
            allowsNa: itemRow.allowsNa !== "false",
            photoUrl: itemRow.photoUrl || undefined,
          })),
      };
    })
    .sort((left, right) => right.date.localeCompare(left.date));
}
