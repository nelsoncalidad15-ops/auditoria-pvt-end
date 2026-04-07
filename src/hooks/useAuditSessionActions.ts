import React from "react";

import { createClientId } from "../lib/utils";
import { AuditSession, IncompleteAuditListItem, Location } from "../types";

interface DeleteConfirmModalState {
  show: boolean;
  auditId: string;
  auditName: string;
}

interface UseAuditSessionActionsParams {
  canRunAudits: boolean;
  history: AuditSession[];
  sortedDraftAudits: IncompleteAuditListItem[];
  session: Partial<AuditSession>;
  ensureSessionIdentity: (currentSession: Partial<AuditSession>) => Partial<AuditSession>;
  formatAuditMonthLabel: (dateValue?: string) => string;
  buildAuditBatchName: (
    location: Location,
    dateValue: string | undefined,
    existingBatchNames: Iterable<string>,
    formatMonthLabel: (dateValue?: string) => string,
  ) => string;
  createEmptyAuditedFileNames: () => string[];
  resumeDraftSession: (draft: IncompleteAuditListItem) => void;
  setSession: React.Dispatch<React.SetStateAction<Partial<AuditSession>>>;
  setSelectedRole: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedStaff: React.Dispatch<React.SetStateAction<string>>;
  setActiveAuditItemId: React.Dispatch<React.SetStateAction<string | null>>;
  setFocusedAuditItemId: React.Dispatch<React.SetStateAction<string | null>>;
  setView: React.Dispatch<React.SetStateAction<any>>;
  setCompletedAuditReports: React.Dispatch<React.SetStateAction<any[]>>;
  setShowBatchReportModal: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedAudit: React.Dispatch<React.SetStateAction<AuditSession | null>>;
  setDeleteConfirmModal: React.Dispatch<React.SetStateAction<DeleteConfirmModalState>>;
}

export function useAuditSessionActions({
  canRunAudits,
  history,
  sortedDraftAudits,
  session,
  ensureSessionIdentity,
  formatAuditMonthLabel,
  buildAuditBatchName,
  createEmptyAuditedFileNames,
  resumeDraftSession,
  setSession,
  setSelectedRole,
  setSelectedStaff,
  setActiveAuditItemId,
  setFocusedAuditItemId,
  setView,
  setCompletedAuditReports,
  setShowBatchReportModal,
  setSelectedAudit,
  setDeleteConfirmModal,
}: UseAuditSessionActionsParams) {
  const createAuditBatchName = React.useCallback((location: Location, dateValue?: string) => {
    const resolvedDate = dateValue || new Date().toISOString().split("T")[0];
    const monthKey = resolvedDate.slice(0, 7);
    return buildAuditBatchName(
      location,
      resolvedDate,
      [...history, ...sortedDraftAudits]
        .filter((auditSession) => auditSession.location === location && auditSession.date.startsWith(monthKey) && auditSession.auditBatchName?.trim())
        .map((auditSession) => auditSession.auditBatchName!.trim()),
      formatAuditMonthLabel,
    );
  }, [buildAuditBatchName, formatAuditMonthLabel, history, sortedDraftAudits]);

  const ensureSessionMetadata = React.useCallback((currentSession: Partial<AuditSession>) => {
    const sessionWithIdentity = ensureSessionIdentity(currentSession);
    if (sessionWithIdentity.auditBatchName || !sessionWithIdentity.location) {
      return sessionWithIdentity;
    }

    return {
      ...sessionWithIdentity,
      auditBatchName: createAuditBatchName(sessionWithIdentity.location, sessionWithIdentity.date),
    };
  }, [createAuditBatchName, ensureSessionIdentity]);

  const clearSelectedRole = React.useCallback(() => {
    setSelectedRole(null);
    setSelectedStaff("");
  }, [setSelectedRole, setSelectedStaff]);

  const handleResumeTechnicianEvaluation = React.useCallback((auditSession: AuditSession) => {
    setSession({
      id: auditSession.id,
      date: auditSession.date,
      auditBatchName: auditSession.auditBatchName,
      auditorId: auditSession.auditorId,
      location: auditSession.location,
      notes: auditSession.notes,
      items: auditSession.items,
    });
    setSelectedRole("Técnicos");
    setSelectedStaff(auditSession.staffName?.trim() || "");
    setActiveAuditItemId(null);
    setFocusedAuditItemId(null);
    setView("audit");
  }, [setActiveAuditItemId, setFocusedAuditItemId, setSelectedRole, setSelectedStaff, setSession, setView]);

  const startNewAudit = React.useCallback(() => {
    if (!canRunAudits) {
      alert("El perfil Consulta no puede iniciar ni editar auditorías.");
      return;
    }

    setCompletedAuditReports([]);
    setShowBatchReportModal(false);
    setSelectedAudit(null);
    setActiveAuditItemId(null);
    setFocusedAuditItemId(null);
    setSession({
      id: createClientId(),
      date: new Date().toISOString().split("T")[0],
      auditBatchName: undefined,
      auditedFileNames: createEmptyAuditedFileNames(),
      participants: {
        asesorServicio: "",
        tecnico: "",
        controller: "",
        lavador: "",
        repuestos: "",
      },
      items: [],
    });
    setSelectedRole(null);
    setSelectedStaff("");
    setView("setup");
  }, [
    canRunAudits,
    createEmptyAuditedFileNames,
    setActiveAuditItemId,
    setCompletedAuditReports,
    setFocusedAuditItemId,
    setSelectedAudit,
    setSelectedRole,
    setSelectedStaff,
    setSession,
    setShowBatchReportModal,
    setView,
  ]);

  const handleSetupSubmit = React.useCallback(() => {
    if (!canRunAudits) {
      alert("El perfil Consulta no puede iniciar auditorías.");
      return;
    }

    if (session.auditorId && session.location) {
      setSession((current) => ensureSessionMetadata(current));
      setView("audit");
    }
  }, [canRunAudits, ensureSessionMetadata, session.auditorId, session.location, setSession, setView]);

  const handleResumeIncompleteAudit = React.useCallback((draft: IncompleteAuditListItem) => {
    if (draft._source === "history") {
      setSession({
        id: draft.id,
        date: draft.date,
        auditBatchName: draft.auditBatchName,
        auditorId: draft.auditorId,
        location: draft.location,
        orderNumber: draft.orderNumber,
        clientIdentifier: draft.clientIdentifier,
        auditedFileNames: draft.auditedFileNames,
        notes: draft.notes,
        participants: draft.participants,
        items: draft.items ?? [],
      });
      setSelectedRole(draft.role ?? null);
      setSelectedStaff(draft.staffName ?? "");
      setActiveAuditItemId(null);
      setFocusedAuditItemId(null);
      setView("setup");
      return;
    }

    resumeDraftSession(draft);
  }, [
    resumeDraftSession,
    setActiveAuditItemId,
    setFocusedAuditItemId,
    setSelectedRole,
    setSelectedStaff,
    setSession,
    setView,
  ]);

  const handleRequestDeleteIncompleteAudit = React.useCallback((draft: IncompleteAuditListItem) => {
    setDeleteConfirmModal({
      show: true,
      auditId: draft.id,
      auditName: draft.auditBatchName || "Sin nombre",
    });
  }, [setDeleteConfirmModal]);

  return {
    createAuditBatchName,
    ensureSessionMetadata,
    clearSelectedRole,
    handleResumeTechnicianEvaluation,
    startNewAudit,
    handleSetupSubmit,
    handleResumeIncompleteAudit,
    handleRequestDeleteIncompleteAudit,
  };
}
