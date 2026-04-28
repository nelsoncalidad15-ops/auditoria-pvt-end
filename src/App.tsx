/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useState, useEffect } from "react";
import { 
  XCircle, 
  FileCheck,
  History,
  Plus,
  ShieldCheck,
  Settings,
  LayoutDashboard,
  Activity,
  Trash2,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AppShell } from "./app/AppShell";
import { AppStartGate } from "./app/AppStartGate";
import { cn, createClientId } from "./lib/utils";
import { buildAuditSyncPayload, sendAuditToWebhook } from "./services/audit-sync";
import { 
  LOCATIONS, 
  AUDITORS,
  STAFF,
  OR_PARTICIPANTS,
} from "./constants";
import { AppView, AuditSession, AuditTemplateItem, AuditUserProfile, CompletedAuditReport, HistoryPanel, IncompleteAuditListItem, Location, Role } from "./types";
import { buildOrderAuditItems, calculateAuditCompliance, calculateRoleScores } from "./services/or-audit";
import { PRE_DELIVERY_DOCUMENTARY_BLOCK, buildPreDeliveryAuditItems, buildPreDeliveryTemplateItems } from "./services/pre-delivery-audit";
import { auth, googleProvider, isFirebaseConfigured } from "./firebase";
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from "firebase/auth";
import Papa from "papaparse";
import { Button } from "./components/ui/Button";
import { ConfirmModal } from "./components/ui/Modal";
import { useAuditDrafts } from "./hooks/useAuditDrafts";
import { useHashNavigation } from "./hooks/useHashNavigation";
import { useAuditStructure } from "./hooks/useAuditStructure";
import { useAuditSync } from "./hooks/useAuditSync";
import { useAuditSessionActions } from "./hooks/useAuditSessionActions";
import { useDashboardMetrics } from "./hooks/useDashboardMetrics";
import { CategoryGrid } from "./components/audit/CategoryGrid";

const DashboardView = React.lazy(() => import("./components/views/DashboardView").then((module) => ({ default: module.DashboardView })));
const HistoryView = React.lazy(() => import("./components/history/HistoryView").then((module) => ({ default: module.HistoryView })));
const StructurePanel = React.lazy(() => import("./components/reports/StructurePanel").then((module) => ({ default: module.StructurePanel })));
const IntegrationsView = React.lazy(() => import("./components/views/IntegrationsView").then((module) => ({ default: module.IntegrationsView })));
const ContinueAuditsView = React.lazy(() => import("./components/views/ContinueAuditsView").then((module) => ({ default: module.ContinueAuditsView })));
const SetupView = React.lazy(() => import("./components/views/SetupView").then((module) => ({ default: module.SetupView })));
const AuditSessionView = React.lazy(() => import("./components/views/AuditSessionView").then((module) => ({ default: module.AuditSessionView })));
const AuditStaffSelectionView = React.lazy(() => import("./components/views/AuditStaffSelectionView").then((module) => ({ default: module.AuditStaffSelectionView })));


function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error, setError] = React.useState<any>(null);

  React.useEffect(() => {
    const handleError = (e: ErrorEvent) => setError(e.error);
    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  if (error) {
    let errorMessage = "Ocurrió un error inesperado.";
    try {
      const parsed = JSON.parse(error.message);
      if (parsed.error && parsed.error.includes("insufficient permissions")) {
        errorMessage = "Error de permisos: No tienes autorización para realizar esta operación.";
      }
    } catch (e) {
      errorMessage = error.message || errorMessage;
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-red-50 text-center">
        <div className="space-y-4 max-w-sm">
          <XCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-xl font-bold text-red-900">Algo salió mal</h1>
          <p className="text-red-700 text-sm">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}


function buildAuditBatchName(
  location: Location,
  dateValue: string | undefined,
  existingBatchNames: Iterable<string>,
  formatMonthLabel: (dateValue?: string) => string,
) {
  const resolvedDate = dateValue || new Date().toISOString().split("T")[0];
  const nextIndex = new Set(Array.from(existingBatchNames).filter(Boolean)).size + 1;
  return `Auditoria de procesos - ${location} - ${formatMonthLabel(resolvedDate)} (${nextIndex})`;
}

function createEmptyAuditedFileNames() {
  return Array.from({ length: 6 }, () => "");
}

const QUICK_AUDIT_MODE_STORAGE_KEY = "quick-audit-mode";
const USER_PROFILE_STORAGE_KEY = "audit-user-profile";
const INTEGRATION_META_STORAGE_KEY = "audit-integration-meta";
const SYNC_META_STORAGE_KEY = "audit-sync-meta";
const EXPORT_META_STORAGE_KEY = "audit-export-meta";

function getStoredMeta(storageKey: string) {
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

function persistMeta(storageKey: string, payload: { timestamp: string; message?: string }) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(payload));
}

function getDefaultQuickAuditMode() {
  if (typeof window === "undefined") {
    return false;
  }

  const isDesktopViewport = window.matchMedia("(min-width: 1024px)").matches;
  if (!isDesktopViewport) {
    return false;
  }

  return window.localStorage.getItem(QUICK_AUDIT_MODE_STORAGE_KEY) !== "0";
}

const DEFAULT_OBSERVATION_SUGGESTIONS = [
  "Falta firma",
  "Falta sello",
  "Documento incompleto",
  "No coincide con la unidad",
  "No aplica por operación",
];

type OrdersSubmitMode = "continue" | "finish";

function AuditApp() {
  const appTitle = import.meta.env.VITE_APP_TITLE?.trim() || "Auditoría OR Postventa VW";
  const contentContainerRef = React.useRef<HTMLDivElement | null>(null);
  const envWebhookUrl = import.meta.env.VITE_APPS_SCRIPT_URL?.trim() || ""; // Configured via GitHub Secrets
  const envSheetCsvUrl = import.meta.env.VITE_SHEET_CSV_URL?.trim() || ""; // Configured via GitHub Secrets
  const storedIntegrationMeta = getStoredMeta(INTEGRATION_META_STORAGE_KEY);
  const storedSyncMeta = getStoredMeta(SYNC_META_STORAGE_KEY);
  const storedExportMeta = getStoredMeta(EXPORT_META_STORAGE_KEY);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState<AppView>("dashboard");
  const [isSyncing, setIsSyncing] = useState(false);
  const [session, setSession] = useState<Partial<AuditSession>>({
    date: new Date().toISOString().split("T")[0],
    items: []
  });
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAudit, setSelectedAudit] = useState<AuditSession | null>(null);
  const [selectedHistoryAudit, setSelectedHistoryAudit] = useState<AuditSession | null>(null);
  void setSelectedHistoryAudit;
  const [historyPanel, setHistoryPanel] = useState<HistoryPanel>("records");
  const [webhookUrl, setWebhookUrl] = useState<string>(localStorage.getItem("webhookUrl") || envWebhookUrl);
  const [sheetCsvUrl, setSheetCsvUrl] = useState<string>(localStorage.getItem("sheetCsvUrl") || envSheetCsvUrl);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSendingToSheet, setIsSendingToSheet] = useState(false);
  const [lastIntegrationSavedAt, setLastIntegrationSavedAt] = useState<string | null>(storedIntegrationMeta?.timestamp ?? null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(storedSyncMeta?.timestamp ?? null);
  const [lastSyncMessage, setLastSyncMessage] = useState<string>(storedSyncMeta?.message || "Todavía no se ejecutó ninguna sincronización manual.");
  const [lastExportedAt, setLastExportedAt] = useState<string | null>(storedExportMeta?.timestamp ?? null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [focusedAuditItemId, setFocusedAuditItemId] = useState<string | null>(null);
  const [activeAuditItemId, setActiveAuditItemId] = useState<string | null>(null);
  const [completedAuditReports, setCompletedAuditReports] = useState<CompletedAuditReport[]>([]);
  const [auditEntryTab, setAuditEntryTab] = useState<"areas" | "scores">("areas");
  const [showBatchReportModal, setShowBatchReportModal] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ show: boolean; auditId: string; auditName: string }>({ show: false, auditId: "", auditName: "" });
  const [activeAuditBlock, setActiveAuditBlock] = useState<string | null>(null);
  const [preDeliverySection, setPreDeliverySection] = useState<"general" | "legajos">("general");
  const [preDeliveryActiveLegajoIndex, setPreDeliveryActiveLegajoIndex] = useState(0);
  const [draftSaveState, setDraftSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [isQuickAuditMode, setIsQuickAuditMode] = useState<boolean>(() => getDefaultQuickAuditMode());
  const [submissionState, setSubmissionState] = useState<"idle" | "success" | "error">("idle");
  void submissionState;
  void setSubmissionState;
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pendingOrdersSubmitMode, setPendingOrdersSubmitMode] = useState<OrdersSubmitMode>("finish");
  const [userProfile, setUserProfile] = useState<AuditUserProfile>(() => {
    if (typeof window === "undefined") {
      return "auditor";
    }

    const storedProfile = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY);
    return storedProfile === "supervisor" || storedProfile === "consulta" ? storedProfile : "auditor";
  });
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const isFirebaseEnabled = isFirebaseConfigured && Boolean(auth) && Boolean(googleProvider);

  const formatAuditMonthLabel = React.useCallback((dateValue?: string) => {
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
  }, []);

  const ensureSessionIdentity = React.useCallback((currentSession: Partial<AuditSession>) => {
    if (currentSession.id) {
      return currentSession;
    }

    return {
      ...currentSession,
      id: createClientId(),
      date: currentSession.date || new Date().toISOString().split("T")[0],
    };
  }, []);

  const sessionItems = session.items ?? [];
  const hasWebhookUrl = webhookUrl.trim().length > 0;
  const hasSheetCsvUrl = sheetCsvUrl.trim().length > 0;
  const isSheetSyncConfigured = hasWebhookUrl;
  void isSheetSyncConfigured;
  const isHistorySyncConfigured = hasWebhookUrl || hasSheetCsvUrl;
  const {
    history,
    localAuditHistory,
    isUsingExternalHistory,
    historySyncModeLabel,
    upsertLocalAuditHistory,
    removeLocalAuditHistoryItem,
    refreshExternalHistory,
    prependExternalAudit,
    saveToFirestore,
  } = useAuditSync({
    isAuthReady,
    user,
    hasWebhookUrl,
    webhookUrl,
    hasSheetCsvUrl,
  });




  const {
    selectedStructureScope,
    setSelectedStructureScope,
    auditCategories,
    selectedAuditCategory,
    selectedStructureCategory,
    selectedStructureCategoryId,
    setSelectedStructureCategoryId,
    isLoadingStructureFromCloud,
    isSavingStructureToCloud,
    structureStorageLabel,
    lastStructureSavedAt,
    allAuditAreaNames,
    newCategoryName,
    setNewCategoryName,
    newCategoryDescription,
    setNewCategoryDescription,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    newCategoryStaff: _newCategoryStaff,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setNewCategoryStaff: _setNewCategoryStaff,
    newItemText,
    setNewItemText,
    newItemDescription,
    setNewItemDescription,
    newItemBlock,
    setNewItemBlock,
    newItemSector,
    setNewItemSector,
    newItemResponsibleRoles,
    setNewItemResponsibleRoles,
    newItemPriority,
    setNewItemPriority,
    newItemGuidance,
    setNewItemGuidance,
    newItemRequired,
    setNewItemRequired,
    newItemAllowsNa,
    setNewItemAllowsNa,
    newItemWeight,
    setNewItemWeight,
    newItemActive,
    setNewItemActive,
    newItemRequiresCommentOnFail,
    setNewItemRequiresCommentOnFail,
    updateCategory,
    handleAddCategory,
    handleDuplicateCategory,
    handleDeleteCategory,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    handleDuplicateItem: _handleDuplicateItem,
    handleDeleteItem,
    handleAddItem,
    handleMoveItem,
    handleResetStructure,
    handleLoadStructureFromCloud,
    handleSaveStructureToCloud,
    handleSaveStructureToSheet,
    isSavingStructureToSheet,
    hasPendingStructureChanges,
  } = useAuditStructure({
    isAuthReady,
    isCloudStructureAvailable: isFirebaseEnabled,
    hasAuthenticatedUser: Boolean(user),
    userEmail: user?.email,
    selectedRole,
    setSelectedRole,
    setSelectedStaff,
    sessionLocation: session.location,
    hasWebhookUrl,
    webhookUrl,
  });

  const dashboardMetrics = useDashboardMetrics(history);

  // Derive variables expected by the UI from the hook's actual output
  const locationFilter = session.location;
  const filteredHistory = locationFilter
    ? history.filter((s) => s.location === locationFilter)
    : history;
  const historyAverageScore = dashboardMetrics.kpis.average;
  const nonCompliantAudits = dashboardMetrics.kpis.critical;
  const latestHistoryItem = [...history].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const blendedProcessCompliance = dashboardMetrics.kpis.approvedRate;
  const blendedServiceAdvisorScoreRows = dashboardMetrics.roleData.filter(
    (r) => String(r.role).toLowerCase().includes("asesor")
  );
  const blendedTechnicianScoreRows = dashboardMetrics.roleData.filter(
    (r) => String(r.role).toLowerCase().includes("técnico") || String(r.role).toLowerCase().includes("tecnico")
  );
  const areaScoreRows = dashboardMetrics.roleData.map((r) => ({
    role: r.role,
    average: r.promedio,
    evaluations: filteredHistory.filter((s) => s.role === r.role).length,
  }));
  void blendedServiceAdvisorScoreRows;
  void blendedTechnicianScoreRows;

  const getQuestionOrder = (text: string) => {
    const match = text.trim().match(/^(\d+)/);
    return match ? Number.parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
  };
  const selectedAuditItems = [...(selectedAuditCategory?.items ?? [])].sort((left, right) => {
    const leftOrder = left.order ?? getQuestionOrder(left.text);
    const rightOrder = right.order ?? getQuestionOrder(right.text);
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.text.localeCompare(right.text);
  });
  // Helper for case-insensitive role matching
  // Helper for case-insensitive role matching and keyword detection
  const matchesRole = (role: string | null, target: string, keywords: string[] = []) => {
    if (!role) return false;
    const normalizedRole = role.trim().toLowerCase();
    const normalizedTarget = target.trim().toLowerCase();
    return normalizedRole === normalizedTarget || keywords.some(k => normalizedRole.includes(k.toLowerCase()));
  };

  const isOrdersAudit = matchesRole(selectedRole, "Ordenes", ["ordenes", "or postventa"]);
  const isServiceAdvisorAudit = matchesRole(selectedRole, "Asesores de servicio", ["asesor"]);
  const isTechnicianAudit = matchesRole(selectedRole, "Técnicos", ["técnico", "taller"]);
  const isPreDeliveryAudit = matchesRole(selectedRole, "Pre Entrega", ["pdi", "pre entrega"]);
  const auditedFileNames = Array.from({ length: 6 }, (_, index) => session.auditedFileNames?.[index] ?? "");
  const trimmedAuditedFileNames = auditedFileNames.map((name) => name.trim());
  const preDeliveryAuditItems = isPreDeliveryAudit
    ? buildPreDeliveryTemplateItems(selectedAuditItems, auditedFileNames)
    : [];
  const displayedAuditItems = isPreDeliveryAudit ? preDeliveryAuditItems : selectedAuditItems;
  const sessionOrderItems = isOrdersAudit
    ? buildOrderAuditItems(selectedAuditItems, sessionItems, selectedRole || "Ordenes")
    : sessionItems;
  const sessionPreDeliveryItems = isPreDeliveryAudit
    ? buildPreDeliveryAuditItems(selectedAuditItems, sessionItems, auditedFileNames, selectedRole || "Pre Entrega")
    : sessionItems;
  const preDeliveryGeneralItems = isPreDeliveryAudit
    ? displayedAuditItems.filter((item) => !(item.block || "").startsWith("Legajo auditado "))
    : [];
  const preDeliveryLegajoSections = isPreDeliveryAudit
    ? Array.from(
        displayedAuditItems
          .filter((item) => (item.block || "").startsWith("Legajo auditado "))
          .reduce((acc, item) => {
            const sectionTitle = item.block || "Legajo auditado";
            const current = acc.get(sectionTitle) ?? [];
            current.push(item);
            acc.set(sectionTitle, current);
            return acc;
          }, new Map<string, AuditTemplateItem[]>())
      )
    : [];
  const preDeliveryLegajoItems = isPreDeliveryAudit
    ? preDeliveryLegajoSections.flatMap(([, sectionItems]) => sectionItems)
    : [];
  const activePreDeliveryLegajoName = trimmedAuditedFileNames[preDeliveryActiveLegajoIndex] ?? "";
  const activePreDeliveryLegajoTitle = activePreDeliveryLegajoName
    ? `Legajo auditado ${preDeliveryActiveLegajoIndex + 1}: ${activePreDeliveryLegajoName}`
    : null;
  const formatPreDeliveryLegajoQuestion = (question: string) => {
    const separatorIndex = question.indexOf(" ? ");
    return separatorIndex >= 0 ? question.slice(separatorIndex + 3) : question;
  };
  const activePreDeliveryLegajoItems = isPreDeliveryAudit && activePreDeliveryLegajoTitle
    ? displayedAuditItems.filter((item) => item.block === activePreDeliveryLegajoTitle)
    : [];
  const preDeliveryDocumentaryTemplateCount = selectedAuditItems.filter(
    (item) => item.block === PRE_DELIVERY_DOCUMENTARY_BLOCK
  ).length;
  const preDeliveryLegajoCards = auditedFileNames.map((name, index) => {
    const trimmedName = name.trim();
    const blockTitle = trimmedName ? `Legajo auditado ${index + 1}: ${trimmedName}` : null;
    const checklistItems = blockTitle
      ? displayedAuditItems.filter((item) => item.block === blockTitle)
      : [];
    const answeredCount = checklistItems.filter(
      (auditItem) => sessionItems.some((item) => (item.id === auditItem.id || item.question === auditItem.text) && item.status)
    ).length;
    const totalCount = checklistItems.length || preDeliveryDocumentaryTemplateCount;
    const completionRatio = totalCount > 0 ? answeredCount / totalCount : 0;
    const status = !trimmedName && answeredCount === 0
      ? "empty"
      : answeredCount > 0 && answeredCount >= totalCount
        ? "complete"
        : "in-progress";

    return {
      index,
      name,
      trimmedName,
      checklistItems,
      answeredCount,
      totalCount,
      completionRatio,
      status,
      isActive: preDeliveryActiveLegajoIndex === index,
    };
  });
  const activePreDeliveryLegajoCard = preDeliveryLegajoCards[preDeliveryActiveLegajoIndex] ?? preDeliveryLegajoCards[0] ?? null;
  const _canGoToPreviousLegajo = preDeliveryActiveLegajoIndex > 0;
  const _canGoToNextLegajo = preDeliveryActiveLegajoIndex < preDeliveryLegajoCards.length - 1;
  void _canGoToPreviousLegajo;
  void _canGoToNextLegajo;
  const visibleAuditItems = isPreDeliveryAudit
    ? preDeliverySection === "general"
      ? preDeliveryGeneralItems
      : activePreDeliveryLegajoItems
    : activeAuditBlock 
      ? displayedAuditItems.filter(item => item.block === activeAuditBlock)
      : displayedAuditItems;
  const isAuditItemAnswered = React.useCallback((auditItem: AuditTemplateItem, items: AuditSession["items"] = sessionItems) => (
    items.some((item) => (item.id === auditItem.id || item.question === auditItem.text) && item.status)
  ), [sessionItems]);
  const getAnsweredAuditItem = React.useCallback((auditItem: AuditTemplateItem, items: AuditSession["items"] = sessionItems) => (
    items.find((item) => item.id === auditItem.id || item.question === auditItem.text)
  ), [sessionItems]);
  const findNextPendingAuditItem = React.useCallback((
    items: AuditSession["items"],
    candidates: AuditTemplateItem[],
    currentQuestion?: string,
  ) => {
    if (candidates.length === 0) {
      return null;
    }

    const currentIndex = currentQuestion
      ? candidates.findIndex((auditItem) => auditItem.text === currentQuestion)
      : -1;
    const trailingItems = currentIndex >= 0 ? candidates.slice(currentIndex + 1) : candidates;
    const nextTrailingPending = trailingItems.find((auditItem) => !isAuditItemAnswered(auditItem, items));

    if (nextTrailingPending) {
      return nextTrailingPending;
    }

    return candidates.find((auditItem) => !isAuditItemAnswered(auditItem, items)) ?? null;
  }, [isAuditItemAnswered]);
  const isAuditChecklistCompleted = displayedAuditItems.length > 0 && displayedAuditItems.every((auditItem) => isAuditItemAnswered(auditItem));
  const answeredGeneralCount = preDeliveryGeneralItems.filter(
    (auditItem) => sessionItems.some((item) => (item.id === auditItem.id || item.question === auditItem.text) && item.status)
  ).length;
  const answeredLegajoCount = preDeliveryLegajoItems.filter(
    (auditItem) => sessionItems.some((item) => (item.id === auditItem.id || item.question === auditItem.text) && item.status)
  ).length;
  void answeredGeneralCount;
  void answeredLegajoCount;
  const _selectedAuditStaffOptions = selectedAuditCategory?.staffOptions ?? [];
  void _selectedAuditStaffOptions;
  const _sessionParticipants = session.participants ?? {
    asesorServicio: "",
    tecnico: "",
    controller: "",
    lavador: "",
    repuestos: "",
  };
  void _sessionParticipants;
  const currentOrCompliance = isOrdersAudit
    ? calculateAuditCompliance(sessionOrderItems)
    : {
        compliance: (() => {
          const sourceItems = isPreDeliveryAudit ? sessionPreDeliveryItems : sessionItems;
          const validItems = sourceItems.filter((item) => item.status !== "na");
          if (validItems.length === 0) {
            return 0;
          }

          const passItems = validItems.filter((item) => item.status === "pass");
          return Math.round((passItems.length / validItems.length) * 100);
        })(),
        obtainedWeight: 0,
        totalApplicableWeight: 0,
        itemsCount: isPreDeliveryAudit ? sessionPreDeliveryItems.length : sessionItems.length,
      };
  void currentOrCompliance;
  void (isAuditChecklistCompleted ? "is-complete" : "is-in-progress");
  const activeAuditItem = visibleAuditItems.find((auditItem) => auditItem.id === activeAuditItemId) ?? null;
  const activeAuditSessionItem = activeAuditItem ? getAnsweredAuditItem(activeAuditItem) : undefined;
  const activeAuditItemIndex = activeAuditItem ? visibleAuditItems.findIndex((auditItem) => auditItem.id === activeAuditItem.id) : -1;
  const draftSaveStateLabel = draftSaveState === "saving"
    ? "Guardando borrador..."
    : draftSaveState === "saved"
      ? "Borrador guardado"
      : "Borrador listo";
  const observationSuggestions = isPreDeliveryAudit && preDeliverySection === "legajos"
    ? DEFAULT_OBSERVATION_SUGGESTIONS
    : matchesRole(selectedRole, "Lavadero", ["lavadero", "lavado"])
      ? [
          "Falta limpieza",
          "Detalle incompleto",
          "No coincide con est?ndar",
          "Elemento ausente",
          "Pendiente de corregir",
        ]
      : DEFAULT_OBSERVATION_SUGGESTIONS;
  const getLastAuditItemStorageKey = React.useCallback((sessionId?: string) => {
    if (!sessionId) {
      return null;
    }

    return `audit-last-item:${sessionId}`;
  }, []);
  const resumeTargetAuditItem = React.useMemo(() => {
    const fallbackItem = findNextPendingAuditItem(sessionItems, visibleAuditItems) ?? visibleAuditItems[0] ?? null;
    const storageKey = getLastAuditItemStorageKey(session.id);

    if (typeof window === "undefined" || !storageKey) {
      return fallbackItem;
    }

    const storedId = window.sessionStorage.getItem(storageKey) || window.localStorage.getItem(storageKey);
    if (!storedId) {
      return fallbackItem;
    }

    return visibleAuditItems.find((auditItem) => auditItem.id === storedId) ?? fallbackItem;
  }, [findNextPendingAuditItem, getLastAuditItemStorageKey, session.id, sessionItems, visibleAuditItems]);
  const _nextPendingLegajoIndex = React.useMemo(() => {
    if (!isPreDeliveryAudit || preDeliverySection !== "legajos" || preDeliveryLegajoCards.length === 0) {
      return null;
    }

    for (let offset = 1; offset <= preDeliveryLegajoCards.length; offset += 1) {
      const nextIndex = (preDeliveryActiveLegajoIndex + offset) % preDeliveryLegajoCards.length;
      const legajoCard = preDeliveryLegajoCards[nextIndex];
      if (!legajoCard || legajoCard.status === "complete") {
        continue;
      }

      return nextIndex;
    }

    return null;
  }, [isPreDeliveryAudit, preDeliveryActiveLegajoIndex, preDeliveryLegajoCards, preDeliverySection]);
  void _nextPendingLegajoIndex;
  const _currentLegajoCompleted = isPreDeliveryAudit
    && preDeliverySection === "legajos"
    && activePreDeliveryLegajoItems.length > 0
    && activePreDeliveryLegajoItems.every((auditItem) => isAuditItemAnswered(auditItem));
  void _currentLegajoCompleted;
  const _ORDERS_TARGET_PER_ADVISOR = 10;
  const _SERVICE_ADVISOR_TARGET_CLIENTS = 2;
  void _ORDERS_TARGET_PER_ADVISOR;
  void _SERVICE_ADVISOR_TARGET_CLIENTS;
  const _currentAuditBatchName = session.auditBatchName?.trim() || "";
  void _currentAuditBatchName;
  const selectedAuditorOption = AUDITORS.find((auditor) => auditor.id === session.auditorId) ?? null;
  const auditBatchDisplayName = session.auditBatchName?.trim() || (session.location
    ? buildAuditBatchName(
        session.location,
        session.date,
        history
          .filter((auditSession) => 
            auditSession.location === session.location && 
            auditSession.date && 
            session.date &&
            auditSession.date.startsWith(session.date.slice(0, 7)) && 
            auditSession.auditBatchName?.trim()
          )
          .map((auditSession) => auditSession.auditBatchName!.trim()),
        formatAuditMonthLabel,
      )
    : "");
  const optionalPendingCount = displayedAuditItems.filter(
    (auditItem) => !sessionItems.some((item) => (item.id === auditItem.id || item.question === auditItem.text) && item.status)
  ).length;
  const failItemsWithoutCommentCount = displayedAuditItems.filter((auditItem) => {
    if (!auditItem.requiresCommentOnFail) {
      return false;
    }

    const answeredItem = sessionItems.find((item) => item.id === auditItem.id || item.question === auditItem.text);
    return answeredItem?.status === "fail" && !answeredItem.comment?.trim();
  }).length;
  const isSubmitDisabled = sessionItems.length === 0 || isSendingToSheet || failItemsWithoutCommentCount > 0;
  const canRunAudits = userProfile !== "consulta";
  const canAccessStructure = userProfile === "supervisor";
  const canAccessIntegrations = userProfile === "supervisor";
  const resumeDraftSession = React.useCallback((draft: IncompleteAuditListItem) => {
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
    setActiveAuditItemId(null);
    setFocusedAuditItemId(null);
    setSelectedRole(draft.role ?? null);
    setSelectedStaff(draft.staffName ?? "");
    setView(draft.role ? "audit" : "setup");
  }, []);

  const advisorGoal = (OR_PARTICIPANTS.asesorServicio.length || 1) * 10;
  
  const sampledOrdersProgress = React.useMemo(() => {
    const count = completedAuditReports.filter(r => r.role === "Ordenes").length;
    return Math.min(100, Math.round((count / advisorGoal) * 100));
  }, [completedAuditReports, advisorGoal]);

  const sampledServiceAdvisorClientsProgress = React.useMemo(() => {
    const count = completedAuditReports.filter(r => r.role === "Asesores de servicio").length;
    return Math.min(100, Math.round((count / advisorGoal) * 100));
  }, [completedAuditReports, advisorGoal]);

  const {
    sortedDraftAudits,
    removeDraftAudit,
  } = useAuditDrafts({
    selectedRole,
    selectedStaff,
    session,
    sessionItems,
    view,
    onResume: resumeDraftSession,
  });

  // Filtrar solo borradores reales (excluir auditorías ya guardadas en historial)
  const completedSessionIds = new Set([
    ...history.map((h) => h.id),
    ...completedAuditReports.map((r) => r.session.id),
  ]);

  const realDraftAudits = sortedDraftAudits.filter((draft) => !completedSessionIds.has(draft.id));

  // Obtener auditorías incompletas del historial (< 100%)
  const incompletedHistoryAudits: IncompleteAuditListItem[] = history
    .filter((auditSession) => (auditSession.totalScore ?? 0) < 100)
    .map((auditSession) => ({
      id: auditSession.id || "",
      date: auditSession.date,
      auditBatchName: auditSession.auditBatchName,
      auditorId: auditSession.auditorId,
      location: auditSession.location,
      role: auditSession.role,
      items: auditSession.items,
      updatedAt: auditSession.date,
      _source: "history" as const,
      totalScore: auditSession.totalScore,
    }))
    .sort((left, right) => right.date.localeCompare(left.date));

  // Combinar borradores reales + auditorías incompletas del historial
  const allIncompleteAudits: IncompleteAuditListItem[] = [...realDraftAudits, ...incompletedHistoryAudits]
    .sort((left, right) => (right.updatedAt || "").localeCompare(left.updatedAt || ""));

  // Actualizar sidebarItems para incluir "Continuar Auditoría" solo si hay borradores reales
  const updatedSidebarItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    ...(canRunAudits ? [{ id: "setup", label: "Nueva Auditoría", icon: Plus }] : []),
    ...(allIncompleteAudits.length > 0 ? [{ id: "continuar", label: "Continuar Auditoría", icon: Activity }] : []),
    { id: "history", label: "Historial", icon: History },
    ...(canAccessStructure ? [{ id: "structure", label: "Estructura", icon: Settings }] : []),
    ...(canAccessIntegrations ? [{ id: "integrations", label: "Integraciones", icon: ShieldCheck }] : []),
  ];

  const technicianDraftSessions = realDraftAudits
    .filter((draft) => (draft.role || draft.items[0]?.category) === "Técnicos")
    .sort((left, right) => `${right.date}-${right.id}`.localeCompare(`${left.date}-${left.id}`));

  const technicianCompletedSessions = completedAuditReports
    .filter((r) => r.role === "Técnicos" || String(r.role).toLowerCase().includes("técnico"))
    .map((r) => r.session);

  const _getTechnicianAuditState = React.useCallback((staffName: string) => {
    const normalizedName = staffName.trim();

    if (!normalizedName) {
      return {
        state: "idle" as const,
        progressPercent: 0,
        label: "Sin iniciar",
      };
    }

    const currentDraft = technicianDraftSessions.find((draft) => draft.staffName?.trim() === normalizedName);
    const completedSession = technicianCompletedSessions.find((s) => s.staffName?.trim() === normalizedName);
    const isCurrentSelection = isTechnicianAudit && selectedStaff.trim() === normalizedName;

    const currentItems = isCurrentSelection
      ? sessionItems
      : currentDraft?.items ?? completedSession?.items ?? [];
    const totalItems = displayedAuditItems.length || currentDraft?.items?.length || completedSession?.items?.length || 0;
    const completedItems = currentItems.filter((item) => item.status).length;
    const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    if (progressPercent >= 100 || completedSession) {
      return {
        state: "complete" as const,
        progressPercent: 100,
        label: "Completado",
      };
    }

    if (progressPercent > 0 || currentDraft) {
      return {
        state: "in-progress" as const,
        progressPercent,
        label: "En proceso",
      };
    }

    return {
      state: "idle" as const,
      progressPercent: 0,
      label: "Sin iniciar",
    };
  }, [displayedAuditItems.length, selectedStaff, sessionItems, technicianDraftSessions, technicianCompletedSessions, isTechnicianAudit]);
  const currentStaffAuditCount = React.useMemo(() => {
    if (!selectedStaff) return 0;
    return completedAuditReports.filter((r) => 
      r.session.staffName?.trim() === selectedStaff.trim() && 
      (r.role === selectedRole || (isOrdersAudit && r.role === "Ordenes")) &&
      r.session.date === session.date
    ).length;
  }, [completedAuditReports, selectedStaff, selectedRole, isOrdersAudit, session.date]);

  void _getTechnicianAuditState;

  const {
    ensureSessionMetadata,
    clearSelectedRole,
    startNewAudit,
    handleSetupSubmit,
    handleResumeIncompleteAudit,
    handleRequestDeleteIncompleteAudit,
  } = useAuditSessionActions({
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
  });

  const { handleTopbarBack } = useHashNavigation({
    view,
    selectedRole,
    setView,
    setSelectedRole,
    clearSelectedRole,
  });

  const getAuditItemStatusLabel = (status?: string | null) => {
    if (status === "pass") return "Cumple";
    if (status === "fail") return "No cumple";
    if (status === "na") return "N/A";
    return "Pendiente";
  };

  const getSectionScores = (templateItems: AuditTemplateItem[], auditSession: AuditSession) =>
    Array.from(
      templateItems.reduce((acc, item) => {
        const blockName = item.block?.trim() || "General";
        const current = acc.get(blockName) ?? [];
        current.push(item);
        acc.set(blockName, current);
        return acc;
      }, new Map<string, AuditTemplateItem[]>())
    ).map(([sectionName, items]) => {
      const answers = items.map((templateItem) => (
        auditSession.items.find((sessionItem) => sessionItem.id === templateItem.id || sessionItem.question === templateItem.text)
      ));
      const passCount = answers.filter((answer) => answer?.status === "pass").length;
      const failCount = answers.filter((answer) => answer?.status === "fail").length;
      const naCount = answers.filter((answer) => answer?.status === "na").length;
      const pendingCount = answers.filter((answer) => !answer).length;
      const validCount = passCount + failCount;

      return {
        sectionName,
        passCount,
        failCount,
        naCount,
        pendingCount,
        score: validCount > 0 ? Math.round((passCount / validCount) * 100) : 0,
      };
    });

  useEffect(() => {
    if (!focusedAuditItemId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const target = document.getElementById(`audit-item-${focusedAuditItemId}`);
      if (!target) {
        return;
      }

      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 180);

    const clearId = window.setTimeout(() => setFocusedAuditItemId(null), 2600);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearTimeout(clearId);
    };
  }, [focusedAuditItemId]);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [view]);

  useEffect(() => {
    if (!isPreDeliveryAudit) {
      setPreDeliverySection("general");
      setPreDeliveryActiveLegajoIndex(0);
    }
  }, [isPreDeliveryAudit]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(QUICK_AUDIT_MODE_STORAGE_KEY, isQuickAuditMode ? "1" : "0");
  }, [isQuickAuditMode]);

  useEffect(() => {
    const storageKey = getLastAuditItemStorageKey(session.id);
    if (typeof window === "undefined" || !storageKey || !activeAuditItemId) {
      return;
    }

    window.sessionStorage.setItem(storageKey, activeAuditItemId);
    window.localStorage.setItem(storageKey, activeAuditItemId);
  }, [activeAuditItemId, getLastAuditItemStorageKey, session.id]);

  useEffect(() => {
    if (view !== "audit" || visibleAuditItems.length === 0) {
      return;
    }

    if (activeAuditItemId && visibleAuditItems.some((auditItem) => auditItem.id === activeAuditItemId)) {
      return;
    }

    const nextActiveItem = resumeTargetAuditItem ?? visibleAuditItems[0] ?? null;
    if (nextActiveItem) {
      setActiveAuditItemId(nextActiveItem.id);
    }
  }, [activeAuditItemId, resumeTargetAuditItem, view, visibleAuditItems]);

  useEffect(() => {
    if (view !== "setup" && view !== "audit") {
      setDraftSaveState("idle");
      return;
    }

    if (!session.id) {
      return;
    }

    setDraftSaveState("saving");
    const timeoutId = window.setTimeout(() => setDraftSaveState("saved"), 420);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [selectedRole, selectedStaff, session, sessionItems, view]);

  useEffect(() => {
    if (!isPreDeliveryAudit || preDeliverySection !== "legajos") {
      return;
    }

    if (preDeliveryActiveLegajoIndex < auditedFileNames.length) {
      return;
    }

    setPreDeliveryActiveLegajoIndex(0);
  }, [auditedFileNames.length, isPreDeliveryAudit, preDeliveryActiveLegajoIndex, preDeliverySection]);

  useEffect(() => {
    if ((view === "setup" || view === "audit") && (!session.id || (session.location && !session.auditBatchName))) {
      setSession((current) => ensureSessionMetadata(current));
    }
  }, [ensureSessionMetadata, session.auditBatchName, session.id, session.location, view]);

  useEffect(() => {
    contentContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [view, selectedRole]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(USER_PROFILE_STORAGE_KEY, userProfile);
  }, [userProfile]);

  useEffect(() => {
    if (canRunAudits) {
      return;
    }

    if (view === "setup" || view === "audit" || view === "home" || view === "structure" || view === "integrations") {
      setView("dashboard");
      return;
    }
  }, [canRunAudits, view]);

  useEffect(() => {
    if (!canAccessStructure && view === "structure") {
      setView("dashboard");
    }
  }, [canAccessStructure, view]);

  useEffect(() => {
    if (!canAccessIntegrations && view === "integrations") {
      setView("dashboard");
    }
  }, [canAccessIntegrations, view]);

  useEffect(() => {
    if (view !== "history") {
      return;
    }

    if (filteredHistory.length === 0) {
      if (selectedAudit) {
        setSelectedAudit(null);
      }
      return;
    }

    if (!selectedAudit || !filteredHistory.some((item: any) => item.id === selectedAudit.id)) {
      setSelectedAudit(filteredHistory[0]);
    }
  }, [filteredHistory, selectedAudit, view]);

  const saveIntegrationSettings = () => {
    localStorage.setItem("webhookUrl", webhookUrl.trim());
    localStorage.setItem("sheetCsvUrl", sheetCsvUrl.trim());
    const timestamp = new Date().toISOString();
    persistMeta(INTEGRATION_META_STORAGE_KEY, {
      timestamp,
      message: "Configuración de integraciones actualizada.",
    });
    setLastIntegrationSavedAt(timestamp);
    alert("Configuración guardada correctamente.");
  };

  const exportToCSV = () => {
    if (history.length === 0) return;
    
    const data = history.flatMap(session => 
      session.items.map(item => ({
        Fecha: session.date,
        Ubicacion: session.location,
        Auditor: AUDITORS.find(a => a.id === session.auditorId)?.name || "N/A",
        Puesto: session.role || item.category,
        Personal: session.staffName || "N/A",
        OR: session.orderNumber || "N/A",
        Pregunta: item.question,
        Estado: item.status === "pass" ? "Cumple" : item.status === "fail" ? "No Cumple" : "N/A",
        Observacion: item.comment || "",
        PuntajeTotal: session.totalScore + "%",
        NotasGenerales: session.notes || ""
      }))
    );

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `auditorias_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const timestamp = new Date().toISOString();
    persistMeta(EXPORT_META_STORAGE_KEY, {
      timestamp,
      message: "Historial exportado a CSV.",
    });
    setLastExportedAt(timestamp);
  };

  // Auth Listener
  useEffect(() => {
    if (!auth || !isFirebaseEnabled) {
      setUser(null);
      setIsAuthReady(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [isFirebaseEnabled]);

  const handleSelectProfile = (profile: AuditUserProfile) => {
    setUserProfile(profile);
    window.localStorage.setItem(USER_PROFILE_STORAGE_KEY, profile);
    if (profile === "consulta") {
      setView("dashboard");
    }
    setIsSessionStarted(true);
  };

  const handleLogin = async () => {
    if (!auth || !googleProvider || !isFirebaseEnabled) {
      return;
    }

    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        setIsLoggingIn(false);
        return;
      }

      console.error("Login failed:", error);

      if (error.code === 'auth/popup-blocked') {
        alert("El navegador bloque? la ventana de acceso. Permit? popups e intent? de nuevo.");
      } else if (error.code === 'auth/unauthorized-domain') {
        alert("Este dominio no est? habilitado. Agregalo en Firebase Authentication > Settings > Authorized domains.");
      } else if (error.code === 'auth/operation-not-allowed') {
        alert("Google no est? habilitado como m?todo de acceso en Firebase Authentication.");
      } else if (error.code === 'auth/invalid-api-key') {
        alert("La configuraci?n de Firebase es inv?lida. Revis? la API key del proyecto.");
      } else {
        alert("No se pudo iniciar sesi?n con Google. Revis? la configuraci?n de Firebase Authentication.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (!auth || !isFirebaseEnabled) {
      setUser(null);
    } else {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Logout failed:", error);
      }
    }
    setIsSessionStarted(false);
    setView("dashboard");
  };

  const handleDeleteAudit = React.useCallback((auditId: string) => {
    removeDraftAudit(auditId);
    removeLocalAuditHistoryItem(auditId);
    setCompletedAuditReports((current) =>
      current.filter((report) => report.session.id !== auditId)
    );
    setDeleteConfirmModal({ show: false, auditId: "", auditName: "" });
  }, [removeDraftAudit, removeLocalAuditHistoryItem]);

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleAuditSubmit = (submitMode: OrdersSubmitMode = "finish") => {
    if (!selectedRole || !selectedAuditCategory) return;

    if (isOrdersAudit && !/^\d{1,10}$/.test(session.orderNumber?.trim() || "")) {
      alert("Ingresá un número de OR válido (solo números).");
      return;
    }

    const currentAsesor = session.participants?.asesorServicio?.trim() || selectedStaff.trim();
    if (isOrdersAudit && !currentAsesor) {
      alert("Complete el asesor de servicio antes de cerrar la OR.");
      return;
    }

    if (isServiceAdvisorAudit && !selectedStaff.trim()) {
      alert("Seleccioná el asesor de servicio antes de cerrar la auditoría.");
      return;
    }

    if (isServiceAdvisorAudit && !session.clientIdentifier?.trim()) {
      alert("Ingresá el nombre o VIN del cliente auditado.");
      return;
    }

    if (isTechnicianAudit && !selectedStaff.trim()) {
      alert("Seleccioná el técnico antes de cerrar la auditoría.");
      return;
    }

    if (failItemsWithoutCommentCount > 0) {
      alert(`Hay ${failItemsWithoutCommentCount} desvíos que requieren observación obligatoria antes del cierre.`);
      return;
    }

    if (optionalPendingCount > 0) {
      setPendingOrdersSubmitMode(submitMode);
      setShowConfirmModal(true);
      return;
    }
    submitAudit(submitMode);
  };

  const confirmAuditSubmit = () => {
    submitAudit(pendingOrdersSubmitMode);
  };


  const focusAuditItem = (auditItem: AuditTemplateItem) => {
    setActiveAuditItemId(auditItem.id);
    setFocusedAuditItemId(auditItem.id);
  };


  const submitAudit = async (submitMode: OrdersSubmitMode = "finish") => {
    if (sessionItems.length === 0) return;

    setIsSendingToSheet(true);

    const normalizedSession = ensureSessionMetadata(session);

    const finalItems = isOrdersAudit
      ? sessionOrderItems
      : isPreDeliveryAudit
        ? sessionPreDeliveryItems
        : sessionItems;
    const complianceMetrics = calculateAuditCompliance(finalItems);
    const roleScores = isOrdersAudit ? calculateRoleScores(finalItems) : [];

    const completeSession: AuditSession = {
      ...normalizedSession as AuditSession,
      userProfile,
      staffName: (selectedStaff || session.participants?.asesorServicio || session.staffName || "").trim(),
      role: selectedRole!,
      orderNumber: (isOrdersAudit || isServiceAdvisorAudit) ? session.orderNumber?.trim() || undefined : undefined,
      clientIdentifier: (isServiceAdvisorAudit || isPreDeliveryAudit) ? session.clientIdentifier?.trim() || undefined : undefined,
      auditedFileNames: isPreDeliveryAudit ? auditedFileNames.map((name) => name.trim()) : undefined,
      totalScore: complianceMetrics.compliance,
      items: finalItems,
      participants: session.participants,
      roleScores,
      entityType: isOrdersAudit ? "or" : "general",
    };
    const shouldKeepOrdersAdvisor = completeSession.role === "Ordenes" && submitMode === "continue";
    const shouldKeepServiceAdvisor = completeSession.role === "Asesores de servicio" && submitMode === "continue";
    const shouldKeepTechnicianFlow = completeSession.role === "Técnicos" && submitMode === "continue";
    const nextOrdersParticipants = shouldKeepOrdersAdvisor
      ? {
          asesorServicio: completeSession.participants?.asesorServicio?.trim() || "",
          tecnico: "",
          controller: "",
          lavador: "",
          repuestos: "",
        }
      : {
          asesorServicio: "",
          tecnico: "",
          controller: "",
          lavador: "",
          repuestos: "",
        };

    const auditorName = AUDITORS.find((auditor) => auditor.id === completeSession.auditorId)?.name || "N/A";
    let savedRemotely = false;

    try {
      if (hasWebhookUrl) {
        const payload = buildAuditSyncPayload({
          session: completeSession,
          auditorName,
          submittedByEmail: user?.email,
        });

        await sendAuditToWebhook(webhookUrl, payload);
        prependExternalAudit(completeSession);
        void refreshExternalHistory().catch((refreshError) => {
          console.error("External history refresh after submit failed:", refreshError);
        });
        savedRemotely = true;
      }

      if (user && isFirebaseEnabled) {
        try {
          await saveToFirestore(completeSession);
          savedRemotely = true;
        } catch (error) {
          console.error("Firestore secondary save failed:", error);
          if (!hasWebhookUrl) {
            throw error;
          }
        }
      }

      if (!savedRemotely) {
        upsertLocalAuditHistory(completeSession);
      }

      setCompletedAuditReports((current) => {
        const nextReport: CompletedAuditReport = {
          role: completeSession.role || selectedRole!,
          session: completeSession,
          auditorName,
          templateItems: displayedAuditItems,
        };
        const nextReports = [nextReport, ...current];
        const seenReportIds = new Set<string>();

        return nextReports.filter((report) => {
          const reportId = report.session.id || `${report.role}-${report.session.date}-${report.session.orderNumber || "sin-or"}`;
          if (seenReportIds.has(reportId)) {
            return false;
          }

          seenReportIds.add(reportId);
          return true;
        });
      });

      if (session.id) {
        removeDraftAudit(session.id);
      }

      setShowConfirmModal(false);
      setIsSendingToSheet(false);
      setActiveAuditItemId(null);
      setFocusedAuditItemId(null);
      
      const shouldKeepStaff = (shouldKeepOrdersAdvisor || shouldKeepServiceAdvisor);
      setSelectedStaff(shouldKeepStaff ? (completeSession.staffName?.trim() || "") : "");
      
      setView("audit");
      setSession({
        id: createClientId(),
        date: completeSession.date,
        auditBatchName: completeSession.auditBatchName,
        auditorId: completeSession.auditorId,
        location: completeSession.location,
        orderNumber: undefined, // Reset for next order
        clientIdentifier: undefined, // Reset for next client
        auditedFileNames: createEmptyAuditedFileNames(),
        participants: isOrdersAudit ? nextOrdersParticipants : undefined,
        items: [],
      });

      if (!((completeSession.role === "Ordenes" || completeSession.role === "Asesores de servicio" || completeSession.role === "Técnicos") && submitMode === "continue")) {
        setSelectedRole(null);
      }


      if (shouldKeepTechnicianFlow) {
        setSelectedStaff("");
      }

      setSubmissionState("success");
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Submit audit failed:", error);
      setSubmissionState("error");

      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // En caso de error, todavía guardamos localmente para no perder datos
      upsertLocalAuditHistory(completeSession);
      
      setShowConfirmModal(false);
      setIsSendingToSheet(false);
      
      alert(`No se pudo sincronizar: ${errorMessage}. La auditoría se guardó localmente.`);
    }
  };

  const toggleItemStatus = (question: string, status: "pass" | "fail" | "na" | null) => {
    const existingIndex = session.items?.findIndex(i => i.question === question) ?? -1;
    let newItems = [...(session.items ?? [])];
    const templateItem = displayedAuditItems.find((auditItem) => auditItem.text === question);
    
    if (status === null) {
      if (existingIndex >= 0) {
        newItems.splice(existingIndex, 1);
      }
    } else {
      if (existingIndex >= 0) {
        newItems[existingIndex] = { ...newItems[existingIndex], status: status as any };
      } else {
        newItems.push({
          id: templateItem?.id || createClientId(),
          question,
          category: selectedRole!,
          status: status as any,
          comment: "",
          description: templateItem?.description,
          responsibleRoles: templateItem?.responsibleRoles,
          sector: templateItem?.sector,
          weight: templateItem?.weight,
          allowsNa: templateItem?.allowsNa,
          scoreLinks: templateItem?.scoreLinks,
          scoreAreas: templateItem?.scoreLinks?.map((link) => link.area) ?? templateItem?.scoreAreas,
        });
      }
    }

    setSession({ ...session, items: newItems });

    const requiresCommentBeforeAdvance = status === "fail"
      && Boolean(templateItem?.requiresCommentOnFail)
      && !(newItems[existingIndex >= 0 ? existingIndex : newItems.length - 1]?.comment?.trim());
    
    setSession({ ...session, items: newItems });

    if (templateItem) {
      setActiveAuditItemId(templateItem.id);
      setFocusedAuditItemId(templateItem.id);
    }

    if (requiresCommentBeforeAdvance) {
      return;
    }

    const nextItem = findNextPendingAuditItem(newItems, visibleAuditItems, question);
    if (nextItem) {
      focusAuditItem(nextItem);
    }
  };

  const updateItemComment = (question: string, comment: string) => {
    const existingIndex = session.items?.findIndex(i => i.question === question) ?? -1;
    const newItems = [...(session.items ?? [])];
    const templateItem = displayedAuditItems.find((auditItem) => auditItem.text === question);
    
    if (existingIndex >= 0) {
      newItems[existingIndex] = { ...newItems[existingIndex], comment };
    } else {
      newItems.push({
        id: templateItem?.id || createClientId(),
        question,
        category: selectedRole!,
        status: "na",
        comment,
        description: templateItem?.description,
        responsibleRoles: templateItem?.responsibleRoles,
        sector: templateItem?.sector,
        weight: templateItem?.weight,
        allowsNa: templateItem?.allowsNa,
        scoreLinks: templateItem?.scoreLinks,
        scoreAreas: templateItem?.scoreLinks?.map((link) => link.area) ?? templateItem?.scoreAreas,
      });
    }
    
    setSession({ ...session, items: newItems });
  };

  const updateItemPhoto = (question: string, photoUrl?: string) => {
    const existingIndex = session.items?.findIndex(i => i.question === question) ?? -1;
    const newItems = [...(session.items ?? [])];
    const templateItem = displayedAuditItems.find((auditItem) => auditItem.text === question);

    if (existingIndex >= 0) {
      newItems[existingIndex] = { ...newItems[existingIndex], photoUrl };
    } else {
      newItems.push({
        id: templateItem?.id || createClientId(),
        question,
        category: selectedRole!,
        status: "na",
        comment: "",
        description: templateItem?.description,
        responsibleRoles: templateItem?.responsibleRoles,
        sector: templateItem?.sector,
        weight: templateItem?.weight,
        allowsNa: templateItem?.allowsNa,
        scoreLinks: templateItem?.scoreLinks,
        scoreAreas: templateItem?.scoreLinks?.map((link) => link.area) ?? templateItem?.scoreAreas,
        photoUrl,
      });
    }

    setSession({ ...session, items: newItems });
  };

  const syncData = async () => {
    if (!isHistorySyncConfigured) {
      alert("Configur? Apps Script o una URL CSV publicada para sincronizar datos.");
      return;
    }

    setIsSyncing(true);
    try {
      if (hasWebhookUrl) {
        const externalAudits = await refreshExternalHistory();
        const timestamp = new Date().toISOString();
        const syncMessage = externalAudits.length > 0
          ? `Sincronizacion completa desde Apps Script. Se importaron ${externalAudits.length} auditorias.`
          : "Apps Script respondio correctamente, pero no devolvio auditorias nuevas.";
        persistMeta(SYNC_META_STORAGE_KEY, { timestamp, message: syncMessage });
        setLastSyncAt(timestamp);
        setLastSyncMessage(syncMessage);
        alert(
          externalAudits.length > 0
            ? `Historial cargado desde Google Sheets. Se importaron ${externalAudits.length} auditorías.`
            : "La fuente externa respondió correctamente, pero no encontró auditorías para importar."
        );
        setIsSyncing(false);
        return;
      }

      const response = await fetch(sheetCsvUrl);
      if (!response.ok) {
        throw new Error(`No se pudo leer la fuente externa (${response.status}).`);
      }

      const csvText = await response.text();
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = Array.isArray(results.data)
            ? results.data.filter((row) => Object.values((row ?? {}) as Record<string, unknown>).some(Boolean))
            : [];

          if (results.errors.length > 0) {
            console.error("CSV parse failed:", results.errors);
            const timestamp = new Date().toISOString();
            const syncMessage = "La verificacion CSV fallo por formato invalido.";
            persistMeta(SYNC_META_STORAGE_KEY, { timestamp, message: syncMessage });
            setLastSyncAt(timestamp);
            setLastSyncMessage(syncMessage);
            alert("La fuente CSV respondió, pero tiene un formato inválido o incompleto.");
            setIsSyncing(false);
            return;
          }

          const timestamp = new Date().toISOString();
          const syncMessage = `CSV externo verificado correctamente. Se leyeron ${rows.length} registros publicados.`;
          persistMeta(SYNC_META_STORAGE_KEY, { timestamp, message: syncMessage });
          setLastSyncAt(timestamp);
          setLastSyncMessage(syncMessage);
          alert(`CSV externo verificado. Se leyeron ${rows.length} registros publicados.`);
          setIsSyncing(false);
        }
      });
    } catch (error) {
      console.error("Sync failed:", error);
      const timestamp = new Date().toISOString();
      const syncMessage = `Error de sincronizacion: ${error instanceof Error ? error.message : String(error)}`;
      persistMeta(SYNC_META_STORAGE_KEY, { timestamp, message: syncMessage });
      setLastSyncAt(timestamp);
      setLastSyncMessage(syncMessage);
      alert("No se pudo leer la fuente CSV publicada. Revis? la URL y el acceso p?blico.");
      setIsSyncing(false);
    }
  };

  return (
    <AppStartGate
      isAuthReady={isAuthReady}
      isSessionStarted={isSessionStarted}
      appTitle={appTitle}
      isLoggingIn={isLoggingIn}
      firebaseEnabled={isFirebaseEnabled}
      user={user}
      onSelectProfile={handleSelectProfile}
      onLogin={handleLogin}
    >
      <AppShell
        appTitle={appTitle}
        view={view}
        user={user}
        userProfile={userProfile}
        authenticationEnabled={isFirebaseEnabled}
        showSidebar={view === "dashboard" || view === "history" || view === "integrations" || view === "continuar" || view === "setup"}
        sidebarItems={updatedSidebarItems}
        isMobileNavOpen={isMobileNavOpen}
        canRunAudits={canRunAudits}
        contentContainerRef={contentContainerRef}
        onNavigate={(nextView) => {
          if ((nextView as string) === "new-audit") {
            startNewAudit();
            return;
          }

          setView(nextView as AppView);
        }}
        onLogout={handleLogout}
        onOpenMobileNav={() => setIsMobileNavOpen(true)}
        onCloseMobileNav={() => setIsMobileNavOpen(false)}
        onBack={handleTopbarBack}
        onStartAudit={startNewAudit}
        backLabel={view === "audit" ? "Volver a Áreas" : undefined}
      >
        <AnimatePresence mode="wait">
          {showSuccessModal && (
            <motion.div
              key="success-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="max-w-sm w-full bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 text-center shadow-2xl border border-white/5"
              >
                <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 animate-success-pulse">
                  <FileCheck className="h-12 w-12 text-white" />
                </div>
                <h3 className="text-3xl font-black mb-3">¡Completado!</h3>
                <p className="text-slate-500 font-medium mb-10 leading-relaxed">La auditoría ha sido procesada y guardada correctamente en el sistema.</p>
                <Button 
                  className="w-full h-14 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-500/20"
                  onClick={() => setShowSuccessModal(false)}
                >
                  Continuar
                </Button>
              </motion.div>
            </motion.div>
          )}

          {view === "dashboard" && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8 pt-4"
            >
              <Suspense fallback={<div className="rounded-[1.8rem] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500">Cargando dashboard...</div>}>
                <DashboardView history={history} />
              </Suspense>
            </motion.div>
          )}



          {view === "setup" && (
            <motion.div
              key="setup-refactor"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <Suspense fallback={<div className="rounded-[1.8rem] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500">Cargando configuracion...</div>}>
                <SetupView
                  dateLabel={session.date}
                  auditors={AUDITORS}
                  locations={LOCATIONS}
                  selectedAuditorId={session.auditorId}
                  selectedLocation={session.location}
                  auditBatchDisplayName={auditBatchDisplayName}
                  onSelectAuditor={(auditorId) => setSession({ ...session, auditorId })}
                  onSelectLocation={(location) => setSession({ ...session, location })}
                  onCancel={() => setView("dashboard")}
                  onContinue={handleSetupSubmit}
                />
              </Suspense>
            </motion.div>
          )}


          {view === "audit" && (
            <motion.div 
              key="audit"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {!selectedRole ? (
                <div className="space-y-6">
                  <div className="hero-shell rounded-[2.2rem] p-6 shadow-sm lg:p-7">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
                      <div className="space-y-4">
                        <span className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 shadow-sm">
                          <div className="h-2 w-2 rounded-full bg-blue-600" />
                          Categorías
                        </span>
                        <div className="space-y-2">
                          <h2 className="text-2xl font-black tracking-tight text-slate-950 lg:text-3xl">Elegí el área.</h2>
                          {auditBatchDisplayName && (
                            <p className="text-sm font-bold text-slate-600">{auditBatchDisplayName}</p>
                          )}
                        </div>
                        <div className="hidden lg:grid lg:grid-cols-3 lg:gap-3">
                          <div className="rounded-[1.4rem] border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Auditor</p>
                            <p className="mt-2 text-sm font-black text-slate-900">{selectedAuditorOption?.name ?? "Sin definir"}</p>
                          </div>
                          <div className="rounded-[1.4rem] border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Sucursal</p>
                            <p className="mt-2 text-sm font-black text-slate-900">{session.location ?? "Sin definir"}</p>
                          </div>
                          <div className="rounded-[1.4rem] border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Fecha</p>
                            <p className="mt-2 text-sm font-black text-slate-900">{session.date || "Sin definir"}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.4rem] border border-slate-200 bg-white p-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAuditEntryTab("areas")}
                        className={cn(
                          "rounded-[1rem] px-3 py-2.5 text-xs font-black uppercase tracking-[0.14em] transition",
                          auditEntryTab === "areas" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"
                        )}
                      >
                        Elegí el área
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuditEntryTab("scores")}
                        className={cn(
                          "rounded-[1rem] px-3 py-2.5 text-xs font-black uppercase tracking-[0.14em] transition",
                          auditEntryTab === "scores" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"
                        )}
                      >
                        Puntajes
                      </button>
                    </div>
                  </div>

                  {auditEntryTab === "areas" ? (
                    <CategoryGrid
                      categories={auditCategories}
                      completedReports={completedAuditReports}
                      sampledOrdersProgress={sampledOrdersProgress}
                      sampledServiceAdvisorClientsProgress={sampledServiceAdvisorClientsProgress}
                      advisorGoal={advisorGoal}
                      auditCounts={completedAuditReports.reduce((acc, report) => {
                        const areaName = report.role;
                        acc[areaName] = (acc[areaName] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)}
                      onSelectCategory={(category) => {
                        setSelectedRole(category.name);
                        setAuditEntryTab("areas");
                        
                        const blocks = Array.from(new Set(category.items.map(i => i.block).filter(Boolean))) as string[];
                        setActiveAuditBlock(blocks.length > 0 ? blocks[0] : null);

                        if (category.name === "Pre Entrega") {
                          setSelectedStaff("");
                        }
                      }}
                    />
                  ) : (
                    <div className="space-y-6">
                      <div className="premium-card p-6 bg-white dark:bg-white/5 border-white/5 shadow-xl">
                        <div className="mb-6 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                               <Activity className="h-5 w-5" />
                            </div>
                            <p className="text-lg font-black text-slate-900 dark:text-white uppercase italic tracking-tight">Asesores de Servicio</p>
                          </div>
                          <span className="rounded-full bg-slate-100 dark:bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">{blendedServiceAdvisorScoreRows.length} PERFIL(ES)</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-100 dark:border-white/5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                <th className="px-2 py-4">Colaborador</th>
                                <th className="px-2 py-4">Áreas Consolidadas</th>
                                <th className="px-2 py-4 text-center">Cumplimiento</th>
                                <th className="px-2 py-4 text-center">Auditorías</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                              {blendedServiceAdvisorScoreRows.length > 0 ? blendedServiceAdvisorScoreRows.map((row: any) => (
                                <tr key={`advisor-score-${row.personName}`} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                  <td className="px-2 py-4 font-black text-slate-800 dark:text-slate-200">{row.personName}</td>
                                  <td className="px-2 py-4">
                                    <div className="flex flex-wrap gap-1">
                                      {row.areas.map((area: string) => (
                                        <span key={area} className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-white/10 text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase">{area}</span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-2 py-4 text-center">
                                    <span className={cn(
                                      "inline-block px-3 py-1 rounded-xl font-black text-lg",
                                      row.compliance >= 90 ? "bg-emerald-500/10 text-emerald-600" : row.compliance >= 70 ? "bg-amber-500/10 text-amber-600" : "bg-red-500/10 text-red-600"
                                    )}>
                                      {row.compliance}%
                                    </span>
                                  </td>
                                  <td className="px-2 py-4 text-center">
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="text-sm font-black text-slate-900 dark:text-white">{row.evaluations}</span>
                                      {typeof row.linkedItems === "number" && row.linkedItems > 0 && (
                                        <span className="rounded-full bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">
                                          {row.linkedItems} vinculados
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )) : (
                                <tr>
                                  <td className="px-2 py-8 text-sm font-medium text-slate-500 text-center italic" colSpan={4}>No hay registros de asesores en esta sesión.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="premium-card p-6 bg-white dark:bg-white/5 border-white/5 shadow-xl">
                        <div className="mb-6 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                               <Plus className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-lg font-black text-slate-900 dark:text-white uppercase italic tracking-tight">Cuerpo Técnico</p>
                              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Promedio OR + Auditoría Técnica</p>
                            </div>
                          </div>
                          <span className="rounded-full bg-slate-100 dark:bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">{blendedTechnicianScoreRows.length} PERFIL(ES)</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-100 dark:border-white/5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                <th className="px-2 py-4">Técnico</th>
                                <th className="px-2 py-4 text-center">Calidad OR</th>
                                <th className="px-2 py-4 text-center">Aud. Técnica</th>
                                <th className="px-2 py-4 text-center">Final</th>
                                <th className="px-2 py-4 text-center">Auditorías</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                              {blendedTechnicianScoreRows.length > 0 ? blendedTechnicianScoreRows.map((row: any) => (
                                <tr key={`technician-score-${row.personName}`} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                  <td className="px-2 py-4 font-black text-slate-800 dark:text-slate-200">{row.personName}</td>
                                  <td className="px-2 py-4 text-center font-bold text-slate-500">{typeof row.ordersScore === "number" ? `${row.ordersScore}%` : "-"}</td>
                                  <td className="px-2 py-4 text-center font-bold text-slate-500">{typeof row.technicianAuditScore === "number" ? `${row.technicianAuditScore}%` : "-"}</td>
                                  <td className="px-2 py-4 text-center">
                                    <span className={cn(
                                      "inline-block px-3 py-1 rounded-xl font-black text-lg",
                                      row.compliance >= 90 ? "bg-emerald-500/10 text-emerald-600" : row.compliance >= 70 ? "bg-amber-500/10 text-amber-600" : "bg-red-500/10 text-red-600"
                                    )}>
                                      {row.compliance}%
                                    </span>
                                  </td>
                                  <td className="px-2 py-4 text-center font-bold text-slate-900 dark:text-white">{row.evaluations}</td>
                                </tr>
                              )) : (
                                <tr>
                                  <td className="px-2 py-8 text-sm font-medium text-slate-500 text-center italic" colSpan={5}>No hay registros técnicos en esta sesión.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-black text-slate-900">Resultado por área</p>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">{areaScoreRows.length} áreas</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                                <th className="px-2 py-2">Área</th>
                                <th className="px-2 py-2 text-center">Resultado</th>
                                <th className="px-2 py-2 text-center">Auditorías</th>
                              </tr>
                            </thead>
                            <tbody>
                              {areaScoreRows.map((row) => (
                                <tr key={`area-score-${row.role}`} className="border-b border-slate-100 last:border-b-0">
                                  <td className="px-2 py-2.5 font-bold text-slate-800">{row.role}</td>
                                  <td className={cn(
                                    "px-2 py-2.5 text-center font-black",
                                    typeof row.average === "number"
                                      ? row.average >= 90 ? "text-emerald-700" : row.average >= 75 ? "text-amber-700" : "text-red-700"
                                      : "text-slate-400"
                                  )}>{typeof row.average === "number" ? `${row.average}%` : "-"}</td>
                                  <td className="px-2 py-2.5 text-center font-bold text-slate-600">{row.evaluations}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {completedAuditReports.length > 0 && (
                    <div className="flex justify-end">
                      <Button variant="secondary" size="lg" onClick={() => setShowBatchReportModal(true)} className="border-slate-200 bg-white text-slate-900 hover:bg-slate-50">
                        <FileText className="h-4 w-4" />
                        Generar reporte
                      </Button>
                    </div>
                  )}
                </div>
              ) : selectedRole && (
                !selectedStaff || 
                (isOrdersAudit && !session.orderNumber) || 
                (isServiceAdvisorAudit && !session.clientIdentifier)
              ) && !isPreDeliveryAudit ? (
                <AuditStaffSelectionView
                  role={selectedRole}
                  staffList={
                    Object.entries(STAFF).find(([key]) => key.toLowerCase() === selectedRole.toLowerCase())?.[1] || []
                  }
                  selectedStaff={selectedStaff}
                  onSelectStaff={setSelectedStaff}
                  orderNumber={session.orderNumber}
                  onOrderNumberChange={(value) => setSession({ ...session, orderNumber: value })}
                  clientIdentifier={session.clientIdentifier}
                  onClientIdentifierChange={(value) => setSession({ ...session, clientIdentifier: value })}
                  onContinue={() => {
                    setSession(prev => ({
                      ...prev,
                      staffName: selectedStaff,
                      participants: isOrdersAudit ? {
                        ...prev.participants,
                        asesorServicio: selectedStaff,
                      } : prev.participants
                    }));
                  }}
                  onBack={() => setSelectedRole(null)}
                  isOrdersAudit={isOrdersAudit}
                  isServiceAdvisorAudit={isServiceAdvisorAudit}
                  isTechnicianAudit={isTechnicianAudit}
                  staffProgress={undefined}
                />
              ) : (
                <Suspense fallback={<div className="rounded-[1.8rem] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500">Cargando sesión de auditoría...</div>}>
                  <AuditSessionView
                    session={session}
                    selectedRole={selectedRole}
                    isOrdersAudit={isOrdersAudit}
                    isServiceAdvisorAudit={isServiceAdvisorAudit}
                    isTechnicianAudit={isTechnicianAudit}
                    isPreDeliveryAudit={isPreDeliveryAudit}
                    visibleAuditItems={visibleAuditItems}
                    activeAuditBlock={activeAuditBlock}
                    setActiveAuditBlock={setActiveAuditBlock}
                    availableBlocks={Array.from(new Set(displayedAuditItems.map(i => i.block).filter(Boolean))) as string[]}
                    isQuickAuditMode={isQuickAuditMode}
                    setIsQuickAuditMode={setIsQuickAuditMode}
                    draftSaveState={draftSaveState}
                    draftSaveStateLabel={draftSaveStateLabel}
                    preDeliverySection={preDeliverySection}
                    setPreDeliverySection={setPreDeliverySection}
                    activePreDeliveryLegajoCard={activePreDeliveryLegajoCard}
                    activePreDeliveryLegajoItems={activePreDeliveryLegajoItems}
                    activePreDeliveryLegajoName={activePreDeliveryLegajoName}
                    auditedFileNames={auditedFileNames}
                    activeAuditItemId={activeAuditItemId}
                    focusedAuditItemId={focusedAuditItemId}
                    activeAuditItemIndex={activeAuditItemIndex}
                    activeAuditItem={activeAuditItem}
                    activeAuditSessionItem={activeAuditSessionItem}
                    observationSuggestions={observationSuggestions}
                    isAuditChecklistCompleted={isAuditChecklistCompleted}
                    failItemsWithoutCommentCount={failItemsWithoutCommentCount}
                    optionalPendingCount={optionalPendingCount}
                    isSubmitDisabled={isSubmitDisabled}
                    isSendingToSheet={isSendingToSheet}
                    setSession={setSession}
                    focusAuditItem={focusAuditItem}
                    toggleItemStatus={toggleItemStatus}
                    updateItemComment={updateItemComment}
                    updateItemPhoto={updateItemPhoto}
                    handleAuditSubmit={handleAuditSubmit}
                    getAuditItemStatusLabel={getAuditItemStatusLabel}
                    formatPreDeliveryLegajoQuestion={formatPreDeliveryLegajoQuestion}
                    currentStaffAuditCount={currentStaffAuditCount}
                    recentStaffAudits={completedAuditReports.filter(r => r.session.staffName?.trim() === selectedStaff?.trim() && r.role === selectedRole)}
                  />
                </Suspense>
              )}
            </motion.div>
          )}

          {view === "structure" && canAccessStructure && (
            <motion.div
              key="structure"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 pb-12"
            >
              <Suspense fallback={<div className="rounded-[1.6rem] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500">Cargando estructura...</div>}>
                <StructurePanel
                  selectedStructureScope={selectedStructureScope}
                  setSelectedStructureScope={setSelectedStructureScope}
                  structureStorageLabel={structureStorageLabel}
                  isLoadingStructureFromCloud={isLoadingStructureFromCloud}
                  isSavingStructureToCloud={isSavingStructureToCloud}
                  isSavingStructureToSheet={isSavingStructureToSheet}
                  hasPendingStructureChanges={hasPendingStructureChanges}
                  handleLoadStructureFromCloud={handleLoadStructureFromCloud}
                  handleSaveStructureToCloud={handleSaveStructureToCloud}
                  handleSaveStructureToSheet={handleSaveStructureToSheet}
                  handleResetStructure={handleResetStructure}
                  auditCategories={auditCategories}
                  selectedStructureCategory={selectedStructureCategory}
                  selectedStructureCategoryId={selectedStructureCategoryId}
                  setSelectedStructureCategoryId={setSelectedStructureCategoryId}
                  updateCategory={updateCategory}
                  handleDuplicateCategory={handleDuplicateCategory}
                  handleDeleteCategory={handleDeleteCategory}
                  handleDeleteItem={handleDeleteItem}
                  newCategoryName={newCategoryName}
                  setNewCategoryName={setNewCategoryName}
                  newCategoryDescription={newCategoryDescription}
                  setNewCategoryDescription={setNewCategoryDescription}
                  handleAddCategory={handleAddCategory}
                  newItemText={newItemText}
                  setNewItemText={setNewItemText}
                  availableScoreAreas={allAuditAreaNames}
                  newItemDescription={newItemDescription}
                  setNewItemDescription={setNewItemDescription}
                  newItemGuidance={newItemGuidance}
                  setNewItemGuidance={setNewItemGuidance}
                  newItemBlock={newItemBlock}
                  setNewItemBlock={setNewItemBlock}
                  newItemSector={newItemSector}
                  setNewItemSector={setNewItemSector}
                  newItemResponsibleRoles={newItemResponsibleRoles}
                  setNewItemResponsibleRoles={setNewItemResponsibleRoles}
                  newItemPriority={newItemPriority}
                  setNewItemPriority={setNewItemPriority}
                  newItemWeight={newItemWeight}
                  setNewItemWeight={setNewItemWeight}
                  newItemRequired={newItemRequired}
                  setNewItemRequired={setNewItemRequired}
                  newItemAllowsNa={newItemAllowsNa}
                  setNewItemAllowsNa={setNewItemAllowsNa}
                  newItemActive={newItemActive}
                  setNewItemActive={setNewItemActive}
                  newItemRequiresCommentOnFail={newItemRequiresCommentOnFail}
                  setNewItemRequiresCommentOnFail={setNewItemRequiresCommentOnFail}
                  handleAddItem={handleAddItem}
                  handleMoveItem={handleMoveItem}
                  lastStructureSavedAt={lastStructureSavedAt}
                />
              </Suspense>
            </motion.div>
          )}

          {view === "integrations" && canAccessIntegrations && (
            <motion.div
              key="integrations"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 pb-12"
            >
              <Suspense fallback={<div className="rounded-[1.8rem] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500">Cargando integraciones...</div>}>
                <IntegrationsView
                  webhookUrl={webhookUrl}
                  sheetCsvUrl={sheetCsvUrl}
                  onWebhookUrlChange={setWebhookUrl}
                  onSheetCsvUrlChange={setSheetCsvUrl}
                  onSave={saveIntegrationSettings}
                  isFirebaseEnabled={isFirebaseEnabled}
                  isAuthenticated={Boolean(user)}
                  isUsingExternalHistory={isUsingExternalHistory}
                  hasWebhookUrl={hasWebhookUrl}
                  hasSheetCsvUrl={hasSheetCsvUrl}
                  localAuditHistoryCount={localAuditHistory.length}
                  historySyncModeLabel={historySyncModeLabel}
                  lastSyncAt={lastSyncAt}
                  lastSyncMessage={lastSyncMessage}
                  lastExportedAt={lastExportedAt}
                  lastIntegrationSavedAt={lastIntegrationSavedAt}
                />
              </Suspense>
            </motion.div>
          )}

          {view === "continuar" && (
            <motion.div
              key="continuar-refactor"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6 pt-4"
            >
              <Suspense fallback={<div className="rounded-[1.8rem] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500">Cargando auditorias pendientes...</div>}>
                <ContinueAuditsView
                  audits={allIncompleteAudits}
                  onResume={handleResumeIncompleteAudit}
                  onDelete={handleRequestDeleteIncompleteAudit}
                />
              </Suspense>
            </motion.div>
          )}



          {view === "history" && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <Suspense fallback={<div className="rounded-[1.8rem] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500">Cargando historial...</div>}>
                <HistoryView
                  historyPanel={historyPanel}
                  setHistoryPanel={setHistoryPanel}
                  filteredHistory={filteredHistory}
                  selectedHistoryAudit={selectedHistoryAudit}
                  historyAverageScore={historyAverageScore}
                  nonCompliantAudits={nonCompliantAudits}
                  latestHistoryItem={latestHistoryItem}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  onBack={() => setView("dashboard")}
                  onSelectAudit={setSelectedAudit}
                  onExportCsv={exportToCSV}
                  onSyncData={syncData}
                  onDeleteAudit={(audit) => setDeleteConfirmModal({ show: true, auditId: audit.id, auditName: audit.auditBatchName || audit.staffName || "Auditoria sin nombre" })}
                  isSyncing={isSyncing}
                  isHistorySyncConfigured={isHistorySyncConfigured}
                  isUsingExternalHistory={isUsingExternalHistory}
                  hasWebhookUrl={hasWebhookUrl}
                  hasSheetCsvUrl={hasSheetCsvUrl}
                  totalHistoryCount={history.length}
                  historySyncModeLabel={historySyncModeLabel}
                  localAuditHistoryCount={localAuditHistory.length}
                  lastSyncAt={lastSyncAt}
                  lastExportedAt={lastExportedAt}
                  lastSyncMessage={lastSyncMessage}
                />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>


      <ConfirmModal
        show={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmAuditSubmit}
        title={pendingOrdersSubmitMode === "continue"
          ? (isServiceAdvisorAudit
              ? "¿Guardar y continuar con otro asesor?"
              : isTechnicianAudit
                ? "¿Guardar y continuar con otro técnico?"
                : "¿Guardar y continuar con otra OR?")
          : "¿Guardar y finalizar auditoría?"}
        message={pendingOrdersSubmitMode === "continue"
          ? `Quedan ${optionalPendingCount} ítems opcionales sin responder. ¿Deseas guardar esta evaluación y continuar igualmente?`
          : `Quedan ${optionalPendingCount} ítems opcionales sin responder. ¿Deseas finalizar igualmente?`}
      />

      <AnimatePresence>
        {showBatchReportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBatchReportModal(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="premium-glass-alt relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2.5rem] border border-white/20 shadow-2xl"
            >
              <div className="flex items-center justify-between gap-4 border-b border-white/5 bg-white/5 px-8 py-6">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Panel de Resultados</p>
                  </div>
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-white">Análisis Consolidado</h3>
                </div>
                <button
                  onClick={() => setShowBatchReportModal(false)}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-white/60 transition-all hover:bg-white/10 hover:text-white"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 space-y-8 overflow-y-auto px-6 py-8 md:px-10">
                {/* Celebratory Summary Header */}
                <div className="premium-card p-10 bg-slate-950 text-white relative overflow-hidden border border-white/10 shadow-2xl">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.15),transparent_70%)]" />
                  <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
                    <div className="space-y-4 text-center md:text-left">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] font-black uppercase tracking-[0.25em] text-blue-400">
                         Métricas Consolidadas
                      </div>
                      <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-[0.9] italic uppercase">Resultados <br /> del Proceso</h2>
                      <p className="text-slate-400 font-medium text-lg max-w-sm">
                        {blendedProcessCompliance >= 90 
                          ? "¡Excelente desempeño! El estándar de calidad se mantiene en niveles de excelencia."
                          : blendedProcessCompliance >= 70
                            ? "Buen desempeño general. Se identificaron áreas específicas para ajuste y optimización."
                            : "Atención requerida: El nivel de cumplimiento actual demanda una revisión de procesos."}
                      </p>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "h-44 w-44 rounded-[2.5rem] flex flex-col items-center justify-center border-4 shadow-2xl relative transition-transform hover:scale-105",
                        blendedProcessCompliance >= 90 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-emerald-500/20" :
                        blendedProcessCompliance >= 70 ? "bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-amber-500/20" : "bg-red-500/10 border-red-500/30 text-red-500 shadow-red-500/20"
                      )}>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Score</span>
                        <span className="text-7xl font-black tracking-tighter leading-none">{blendedProcessCompliance}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                {completedAuditReports.map((report) => {
                  const sectionScores = getSectionScores(report.templateItems ?? [], report.session);

                  return (
                    <div key={`${report.role}-${report.session.id}`} className="premium-card p-6 bg-white/5 border-white/5 overflow-hidden">
                      <div className="flex flex-col gap-6 border-b border-white/5 pb-6 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-400">{report.session.location}</p>
                          <h4 className="text-xl font-black text-white">{report.role}</h4>
                          <p className="text-sm font-bold text-slate-400">
                            {report.session.staffName || report.auditorName} • {report.session.date}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="rounded-[1.25rem] bg-emerald-500/10 border border-emerald-500/20 px-6 py-3 text-center text-emerald-500">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em]">Resultado</p>
                            <p className="mt-0.5 text-2xl font-black">{report.session.totalScore}%</p>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={async () => {
                              const { generateAuditPdfReport } = await import("./services/audit-report-pdf");
                              await generateAuditPdfReport({
                                appTitle,
                                session: report.session,
                                auditorName: report.auditorName ?? "",
                                templateItems: report.templateItems ?? [],
                              });
                            }}
                          >
                            <FileText className="h-4 w-4" />
                            PDF
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
                        {sectionScores.map((section) => (
                          <div key={section.sectionName} className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{section.sectionName}</p>
                            <p className="mt-2 text-lg font-black text-slate-950">{section.score}%</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                              <span>{section.passCount} ok</span>
                              <span>{section.failCount} fail</span>
                              <span>{section.naCount} n/a</span>
                              <span>{section.pendingCount} pend.</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 space-y-2">
                        {report.session.items.map((item) => (
                          <div key={item.id} className="rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <p className="text-sm font-bold text-slate-800">{item.question}</p>
                              <span className={cn(
                                "inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                                item.status === "pass"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : item.status === "fail"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-slate-100 text-slate-500"
                              )}>
                                {getAuditItemStatusLabel(item.status)}
                              </span>
                            </div>
                            {item.comment && (
                              <p className="mt-2 text-xs font-medium text-slate-500">{item.comment}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-4 md:px-8">
                <Button className="w-full" onClick={() => setShowBatchReportModal(false)}>
                  Cerrar
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedAudit && view !== "history" && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAudit(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="premium-glass-alt relative w-full max-w-2xl overflow-hidden rounded-[3rem] border border-white/10 shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="p-10 border-b border-white/5 bg-white/5 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Inspección Detallada</p>
                  </div>
                  <h3 className="text-2xl font-black text-white tracking-tight leading-tight">
                    {selectedAudit.role || selectedAudit.items[0]?.category}
                  </h3>
                  <p className="text-slate-400 text-sm font-bold mt-1">
                    {selectedAudit.date} • {selectedAudit.location}
                  </p>
                </div>
                <div className={cn(
                  "h-20 w-20 rounded-full flex flex-col items-center justify-center font-black border-4",
                  selectedAudit.totalScore >= 90 ? "border-emerald-500/20 text-emerald-500 bg-emerald-500/5" : 
                  selectedAudit.totalScore >= 70 ? "border-amber-500/20 text-amber-500 bg-amber-500/5" : "border-red-500/20 text-red-500 bg-red-500/5"
                )}>
                  <span className="text-[10px] uppercase opacity-60">Score</span>
                  <span className="text-2xl">{selectedAudit.totalScore}%</span>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Personal Auditado</p>
                    <p className="text-base font-bold text-white">{selectedAudit.staffName || "No especificado"}</p>
                  </div>
                  {selectedAudit.orderNumber && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nº de Orden</p>
                      <p className="text-base font-black text-blue-400 tracking-wider">{selectedAudit.orderNumber}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Detalle de Cumplimiento</p>
                  <div className="space-y-3">
                    {selectedAudit.items.map((item, idx) => (
                      <div key={idx} className="p-5 bg-white/5 rounded-3xl border border-white/5 space-y-3">
                        <div className="flex justify-between items-start gap-6">
                          <p className="text-sm font-bold text-slate-200 leading-snug">{item.question}</p>
                          <span className={cn(
                            "text-[10px] font-black uppercase px-3 py-1.5 rounded-xl shrink-0 border",
                            item.status === "pass" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : 
                            item.status === "fail" ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-slate-500/10 text-slate-400 border-white/10"
                          )}>
                            {item.status === "pass" ? "Cumple" : item.status === "fail" ? "No Cumple" : "N/A"}
                          </span>
                        </div>
                        {item.comment && (
                          <div className="pl-4 border-l-2 border-blue-500/30">
                            <p className="text-[11px] text-slate-400 font-medium italic">"{item.comment}"</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {selectedAudit.notes && (
                  <div className="p-6 bg-blue-600/5 rounded-[2rem] border border-blue-500/20">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Observaciones Generales</p>
                    <p className="text-sm text-slate-300 leading-relaxed">{selectedAudit.notes}</p>
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-white/5 bg-white/5">
                <button 
                  onClick={() => setSelectedAudit(null)}
                  className="w-full py-4 rounded-2xl font-black text-white bg-blue-600 hover:bg-blue-500 transition-all active:scale-95 shadow-lg shadow-blue-600/20"
                >
                  Cerrar Inspección
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de confirmación de eliminación */}
      <AnimatePresence>
        {deleteConfirmModal.show && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmModal({ show: false, auditId: "", auditName: "" })}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="premium-glass relative w-full max-w-md overflow-hidden rounded-[2.5rem] border border-white/10 p-10 shadow-2xl space-y-8"
            >
              <div className="text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6">
                  <Trash2 className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-black text-white tracking-tight">Eliminar Auditoría</h3>
                <p className="text-slate-400 font-medium mt-2">¿Estás seguro de que deseas eliminar este registro de forma permanente?</p>
              </div>

              <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-6 text-center">
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2">Registro Seleccionado</p>
                <p className="text-base font-bold text-white break-words">{deleteConfirmModal.auditName}</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmModal({ show: false, auditId: "", auditName: "" })}
                  className="flex-1 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 font-black text-xs uppercase tracking-widest text-slate-300 hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteAudit(deleteConfirmModal.auditId)}
                  className="flex-1 px-6 py-4 rounded-2xl bg-red-600 hover:bg-red-500 font-black text-xs uppercase tracking-widest text-white transition-all shadow-lg shadow-red-600/20"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      </AppShell>
    </AppStartGate>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuditApp />
    </ErrorBoundary>
  );
}







