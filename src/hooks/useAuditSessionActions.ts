import React from "react";

import { createClientId } from "../lib/utils";
import { AuditSession, AuditSource, IncompleteAuditListItem, Location } from "../types";

interface DeleteConfirmModalState {
  show: boolean;
  auditId: string;
  auditName: string;
  auditSource?: AuditSource;
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
  setIsAuditConfigured: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useAuditSessionActions({
  canRunAudits,
  history,
  sortedDraftAudits,
  session,
  ensureSessionIdentity,
  formatAuditMonthLabel,
  buildAuditBatchName,
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
  setIsAuditConfigured,
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
    setIsAuditConfigured(false);
  }, [setIsAuditConfigured, setSelectedRole, setSelectedStaff]);

  const handleResumeTechnicianEvaluation = React.useCallback((auditSession: AuditSession) => {
    setSession({
      id: auditSession.id,
      date: auditSession.date,
      auditBatchName: auditSession.auditBatchName,
      sampleTarget: auditSession.sampleTarget,
      selectedStaffNames: auditSession.selectedStaffNames,
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
    setIsAuditConfigured(true);
  }, [setActiveAuditItemId, setFocusedAuditItemId, setSelectedRole, setSelectedStaff, setSession, setView, setIsAuditConfigured]);

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
    setIsAuditConfigured(false);
    setSession({
      id: createClientId(),
      date: new Date().toISOString().split("T")[0],
      auditBatchName: undefined,
      sampleTarget: 30,
      selectedStaffNames: [],
      auditedFileNames: Array.from({ length: 6 }, () => ""),
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
    setActiveAuditItemId,
    setCompletedAuditReports,
    setFocusedAuditItemId,
    setSelectedAudit,
    setSelectedRole,
    setSelectedStaff,
    setSession,
    setShowBatchReportModal,
    setView,
    setIsAuditConfigured,
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
      const sourceAudit = draft.childAudits?.[0];
      setCompletedAuditReports(
        (draft.childAudits || []).map((childAudit) => ({
          role: childAudit.role || childAudit.items?.[0]?.category || "General",
          session: childAudit,
          auditorName: childAudit.staffName || "",
          templateItems: [],
        }))
      );
      setSession({
        id: createClientId(),
        date: draft.date,
        auditBatchName: draft.auditBatchName,
        sampleTarget: draft.sampleTarget ?? sourceAudit?.sampleTarget,
        selectedStaffNames: draft.selectedStaffNames ?? sourceAudit?.selectedStaffNames,
        auditorId: draft.auditorId || sourceAudit?.auditorId,
        location: draft.location,
        orderNumber: undefined,
        clientIdentifier: undefined,
        auditedFileNames: draft.auditedFileNames,
        notes: draft.notes,
        participants: sourceAudit?.participants || draft.participants,
        items: draft.items ?? [],
      });
      setSelectedRole(null);
      setSelectedStaff("");
      setActiveAuditItemId(null);
      setFocusedAuditItemId(null);
      setIsAuditConfigured(false);
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
    setIsAuditConfigured,
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
