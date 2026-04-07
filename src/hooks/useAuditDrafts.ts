import { useCallback, useEffect, useMemo, useState } from "react";
import { AuditSession, Location, Role } from "../types";

const AUDIT_DRAFTS_STORAGE_KEY = "auditDrafts";

type AuditView = "dashboard" | "home" | "setup" | "audit" | "history" | "structure" | "integrations" | "continuar";

export interface AuditDraft {
  id: string;
  date: string;
  auditBatchName?: string;
  auditorId?: string;
  location?: Location;
  staffName?: string;
  role?: Role;
  items: AuditSession["items"];
  orderNumber?: string;
  clientIdentifier?: string;
  auditedFileNames?: string[];
  notes?: string;
  participants?: AuditSession["participants"];
  updatedAt: string;
}

interface UseAuditDraftsParams {
  selectedRole: Role | null;
  selectedStaff: string;
  session: Partial<AuditSession>;
  sessionItems: AuditSession["items"];
  view: AuditView;
  onResume: (draft: AuditDraft) => void;
}

function inferDraftRole(draft: Partial<AuditDraft>): Role | undefined {
  if (draft.role) {
    return draft.role;
  }

  const itemRole = draft.items?.find((item) => item.category)?.category;
  return itemRole;
}

function normalizeDraft(rawDraft: Partial<AuditDraft>): AuditDraft {
  const role = inferDraftRole(rawDraft);
  const staffName = rawDraft.staffName?.trim() || (role === "Ordenes" ? rawDraft.participants?.asesorServicio?.trim() : undefined);

  return {
    id: rawDraft.id || crypto.randomUUID(),
    date: rawDraft.date || new Date().toISOString().split("T")[0],
    auditBatchName: rawDraft.auditBatchName,
    auditorId: rawDraft.auditorId,
    location: rawDraft.location,
    staffName: staffName || undefined,
    role,
    items: Array.isArray(rawDraft.items) ? rawDraft.items : [],
    orderNumber: rawDraft.orderNumber?.trim() || undefined,
    clientIdentifier: rawDraft.clientIdentifier?.trim() || undefined,
    auditedFileNames: Array.isArray(rawDraft.auditedFileNames)
      ? rawDraft.auditedFileNames.slice(0, 6).map((name) => String(name ?? "").trim())
      : undefined,
    notes: rawDraft.notes?.trim() || undefined,
    participants: rawDraft.participants,
    updatedAt: rawDraft.updatedAt || new Date().toISOString(),
  };
}

export function useAuditDrafts({ selectedRole, selectedStaff, session, sessionItems, view, onResume }: UseAuditDraftsParams) {
  const [draftAudits, setDraftAudits] = useState<AuditDraft[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const rawDrafts = window.localStorage.getItem(AUDIT_DRAFTS_STORAGE_KEY);
      if (!rawDrafts) {
        return [];
      }

      const parsed = JSON.parse(rawDrafts);
      return Array.isArray(parsed) ? parsed.map((draft) => normalizeDraft(draft)) : [];
    } catch {
      return [];
    }
  });

  const persistDrafts = useCallback((nextDrafts: AuditDraft[]) => {
    setDraftAudits(nextDrafts);

    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(AUDIT_DRAFTS_STORAGE_KEY, JSON.stringify(nextDrafts.map((draft) => normalizeDraft(draft))));
  }, []);

  const removeDraftAudit = useCallback((draftId: string) => {
    persistDrafts(draftAudits.filter((draft) => draft.id !== draftId));
  }, [draftAudits, persistDrafts]);

  const resumeDraftAudit = useCallback((draftId: string) => {
    const draft = draftAudits.find((item) => item.id === draftId);
    if (!draft) {
      return;
    }

    onResume(draft);
  }, [draftAudits, onResume]);

  const sortedDraftAudits = useMemo(
    () => [...draftAudits].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [draftAudits]
  );

  useEffect(() => {
    if (!session.id) {
      return;
    }

    if (view !== "setup" && view !== "audit") {
      return;
    }

    const hasMeaningfulProgress = Boolean(
      session.auditorId ||
      session.location ||
      selectedRole ||
      selectedStaff ||
      session.orderNumber?.trim() ||
      session.clientIdentifier?.trim() ||
      session.auditedFileNames?.some((name) => name?.trim()) ||
      session.notes?.trim() ||
      session.participants?.asesorServicio?.trim() ||
      session.participants?.tecnico?.trim() ||
      session.participants?.controller?.trim() ||
      session.participants?.lavador?.trim() ||
      session.participants?.repuestos?.trim() ||
      sessionItems.length > 0
    );

    if (!hasMeaningfulProgress) {
      return;
    }

    const currentDraft = draftAudits.find((draft) => draft.id === session.id);
    const persistedRole = selectedRole || currentDraft?.role;
    const persistedStaffName = (
      persistedRole === "Ordenes"
        ? session.participants?.asesorServicio?.trim()
        : selectedStaff.trim()
    ) || currentDraft?.staffName;

    const nextDraft: AuditDraft = normalizeDraft({
      id: session.id,
      date: session.date || new Date().toISOString().split("T")[0],
      auditBatchName: session.auditBatchName,
      auditorId: session.auditorId,
      location: session.location,
      staffName: persistedStaffName,
      role: persistedRole,
      items: sessionItems,
      orderNumber: session.orderNumber?.trim() || undefined,
      clientIdentifier: session.clientIdentifier?.trim() || undefined,
      auditedFileNames: session.auditedFileNames,
      notes: session.notes?.trim() || undefined,
      participants: session.participants,
      updatedAt: new Date().toISOString(),
    });

    if (currentDraft) {
      const currentComparable = JSON.stringify({
        id: currentDraft.id,
        date: currentDraft.date,
        auditBatchName: currentDraft.auditBatchName,
        auditorId: currentDraft.auditorId,
        location: currentDraft.location,
        staffName: currentDraft.staffName,
        role: currentDraft.role,
        items: currentDraft.items,
        orderNumber: currentDraft.orderNumber,
        clientIdentifier: currentDraft.clientIdentifier,
        auditedFileNames: currentDraft.auditedFileNames,
        notes: currentDraft.notes,
        participants: currentDraft.participants,
      });
      const nextComparable = JSON.stringify({
        id: nextDraft.id,
        date: nextDraft.date,
        auditBatchName: nextDraft.auditBatchName,
        auditorId: nextDraft.auditorId,
        location: nextDraft.location,
        staffName: nextDraft.staffName,
        role: nextDraft.role,
        items: nextDraft.items,
        orderNumber: nextDraft.orderNumber,
        clientIdentifier: nextDraft.clientIdentifier,
        auditedFileNames: nextDraft.auditedFileNames,
        notes: nextDraft.notes,
        participants: nextDraft.participants,
      });

      if (currentComparable === nextComparable) {
        return;
      }
    }

    const nextDrafts = [
      nextDraft,
      ...draftAudits.filter((draft) => draft.id !== nextDraft.id),
    ].slice(0, 8);

    persistDrafts(nextDrafts);
  }, [draftAudits, persistDrafts, selectedRole, selectedStaff, session, sessionItems, view]);

  return {
    draftAudits,
    sortedDraftAudits,
    removeDraftAudit,
    resumeDraftAudit,
  };
}