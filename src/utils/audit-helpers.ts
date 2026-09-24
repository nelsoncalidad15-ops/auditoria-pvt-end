/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuditSession, Location } from "../types";
import { QUICK_AUDIT_MODE_STORAGE_KEY } from "../config/storage-keys";

export function buildAuditBatchName(
  location: Location,
  dateValue: string | undefined,
  existingBatchNames: Iterable<string>,
  formatMonthLabel: (dateValue?: string) => string,
) {
  const resolvedDate = dateValue || new Date().toISOString().split("T")[0];
  const nextIndex = new Set(Array.from(existingBatchNames).filter(Boolean)).size + 1;
  return `Auditoria de procesos - ${location} - ${formatMonthLabel(resolvedDate)} (${nextIndex})`;
}

export function createEmptyAuditedFileNames() {
  return Array.from({ length: 6 }, () => "");
}

export function getStoredMeta(storageKey: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(storageKey);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as { timestamp?: string; message?: string } | null;
  } catch {
    return null;
  }
}

export function buildHistoryGroupKey(audit: AuditSession) {
  const batchName = audit.auditBatchName?.trim();
  if (batchName) {
    return `batch:${batchName.toLowerCase()}`;
  }

  return [
    "audit",
    audit.date || "",
    audit.location || "",
    audit.orderNumber || "",
    audit.clientIdentifier || "",
    audit.staffName || "",
  ].map((value) => String(value).trim().toLowerCase()).join("|");
}

export function summarizeRoles(audits: AuditSession[]) {
  const roles = Array.from(new Set(
    audits
      .map((audit) => audit.role || audit.items[0]?.category)
      .filter((role): role is string => Boolean(role?.trim()))
  ));

  if (roles.length === 0) {
    return "Auditoría general";
  }

  if (roles.length === 1) {
    return roles[0];
  }

  return `${roles.length} áreas`;
}

export function buildGroupedHistory(history: AuditSession[]) {
  const groups = history.reduce((acc, audit) => {
    const groupKey = buildHistoryGroupKey(audit);
    const current = acc.get(groupKey) ?? [];
    current.push(audit);
    acc.set(groupKey, current);
    return acc;
  }, new Map<string, AuditSession[]>());

  return Array.from(groups.values()).map((audits) => {
    const sortedAudits = [...audits].sort((left, right) => `${right.date}-${right.id}`.localeCompare(`${left.date}-${left.id}`));
    const primaryAudit = sortedAudits[0];
    const allItems = sortedAudits.flatMap((audit) => audit.items);
    const childAuditIds = Array.from(new Set(sortedAudits.map((audit) => audit.id)));
    const weightedScore = sortedAudits.reduce((acc, audit) => {
      const itemCount = Math.max(audit.items.length, 1);
      return acc + (audit.totalScore || 0) * itemCount;
    }, 0);
    const totalWeight = sortedAudits.reduce((acc, audit) => acc + Math.max(audit.items.length, 1), 0);
    const staffNames = Array.from(new Set(sortedAudits.map((audit) => audit.staffName?.trim()).filter(Boolean)));
    const orderNumbers = Array.from(new Set(sortedAudits.map((audit) => audit.orderNumber?.trim()).filter(Boolean)));

    return {
      ...primaryAudit,
      id: childAuditIds.join("__"),
      childAuditIds,
      childAudits: sortedAudits,
      auditBatchName: primaryAudit.auditBatchName || `Auditoría ${primaryAudit.date}`,
      staffName: staffNames.length > 1 ? `${staffNames.length} responsables` : primaryAudit.staffName,
      orderNumber: orderNumbers.length > 1 ? `${orderNumbers.length} OR` : primaryAudit.orderNumber,
      role: summarizeRoles(sortedAudits),
      totalScore: Math.round(weightedScore / Math.max(totalWeight, 1)),
      items: allItems,
      notes: sortedAudits.map((audit) => audit.notes?.trim()).filter(Boolean).join("\n"),
      source: sortedAudits.some((audit) => audit.source === "sheet") ? "sheet" : primaryAudit.source,
    } satisfies AuditSession;
  }).sort((left, right) => `${right.date}-${right.id}`.localeCompare(`${left.date}-${left.id}`));
}

export function persistMeta(storageKey: string, payload: { timestamp: string; message?: string }) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(payload));
}

export function getDefaultQuickAuditMode() {
  if (typeof window === "undefined") {
    return false;
  }

  const isDesktopViewport = window.matchMedia("(min-width: 1024px)").matches;
  if (!isDesktopViewport) {
    return false;
  }

  return window.localStorage.getItem(QUICK_AUDIT_MODE_STORAGE_KEY) !== "0";
}

export function formatAuditMonthLabel(dateValue?: string) {
  try {
    const dateToParse = dateValue && dateValue.includes("-") ? `${dateValue}T00:00:00` : dateValue;
    const parsedDate = dateToParse ? new Date(dateToParse) : new Date();
    
    // Verificar si la fecha es válida
    if (isNaN(parsedDate.getTime())) {
      return "Mes";
    }

    const monthLabel = new Intl.DateTimeFormat("es-AR", { month: "long" }).format(parsedDate).trim();
    return monthLabel ? monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1) : "Mes";
  } catch (e) {
    console.error("Error formatting month label:", e);
    return "Mes";
  }
}
