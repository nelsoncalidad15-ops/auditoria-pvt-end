import { AuditSession, Location, OrAuditSector, OrResponsibleRole } from "../types";

export interface AuditSheetSummaryRow {
  auditId: string;
  submittedAt: string;
  auditDate: string;
  auditBatchName: string;
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
  question: string;
  description: string;
  sector: string;
  responsibleRoles: string;
  scoreAreas: string;
  scoreLinks: string;
  weight: number;
  allowsNa: string;
  status: "pass" | "fail" | "na";
  statusLabel: string;
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
  error?: string;
}

const statusLabelMap: Record<AuditSheetItemRow["status"], string> = {
  pass: "Cumple",
  fail: "No Cumple",
  na: "N/A",
};

export function buildAuditSyncPayload(params: {
  session: AuditSession;
  auditorName: string;
  submittedByEmail?: string | null;
}): AuditSyncPayload {
  const { session, auditorName, submittedByEmail } = params;
  const submittedAt = new Date().toISOString();
  const passCount = session.items.filter((item) => item.status === "pass").length;
  const failCount = session.items.filter((item) => item.status === "fail").length;
  const naCount = session.items.filter((item) => item.status === "na").length;
  const answeredCount = passCount + failCount;
  const itemsCount = session.items.length;

  return {
    event: "audit_submitted",
    version: "1.0",
    submittedAt,
    audit: {
      ...session,
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
      itemRows: session.items.map((item, index) => ({
        auditId: session.id,
        submittedAt,
        auditDate: session.date,
        auditBatchName: session.auditBatchName ?? "",
        location: session.location,
        auditorName,
        role: session.role ?? item.category,
        staffName: session.staffName ?? "",
        questionIndex: index + 1,
        question: item.question,
        description: item.description ?? "",
        sector: item.sector ?? "",
        responsibleRoles: Array.isArray(item.responsibleRoles) ? item.responsibleRoles.join(",") : "",
        scoreAreas: Array.isArray(item.scoreAreas) ? item.scoreAreas.join(",") : "",
        scoreLinks: Array.isArray(item.scoreLinks)
          ? item.scoreLinks.map((link) => [
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

function parseNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function isLocation(value: string): value is Location {
  return value === "Salta" || value === "Jujuy";
}

function normalizeStatus(value: string): AuditSheetItemRow["status"] {
  return value === "pass" || value === "fail" || value === "na" ? value : "na";
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
    current.push({
      ...row,
      questionIndex: parseNumber(row.questionIndex),
      status: normalizeStatus(row.status),
    });
    acc.set(auditId, current);
    return acc;
  }, new Map<string, Array<AuditSheetItemRow & { questionIndex: number }>>());

  return summaryRows
    .filter((row): row is AuditSheetSummaryRow & { location: Location } => Boolean(row.auditId && row.auditDate && isLocation(row.location)))
    .map((row) => {
      const location = row.location;

      return {
        id: row.auditId,
        date: row.auditDate,
        auditBatchName: row.auditBatchName || "",
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
        items: (itemsByAuditId.get(row.auditId) ?? [])
          .sort((left, right) => left.questionIndex - right.questionIndex)
          .map((itemRow, index) => ({
            id: `${row.auditId}-${index + 1}`,
            question: itemRow.question,
            category: itemRow.role || row.role || "General",
            status: itemRow.status,
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
