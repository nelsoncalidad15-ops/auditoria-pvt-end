/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useState, useEffect } from "react";
import { 
  FileCheck,
  History,
  Plus,
  ShieldCheck,
  Settings,
  LayoutDashboard,
  Activity,
  Trash2,
  FileText,
  ChevronRight,
  Pencil,
  X,
  Camera,
  ExternalLink,
  CheckCircle2,
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
} from "./constants";
import { AppView, AuditSession, AuditSource, AuditTemplateItem, AuditUserProfile, CompletedAuditReport, HistoryPanel, IncompleteAuditListItem, Role } from "./types";
import { buildOrderAuditItems, calculateAuditCompliance, calculateRoleScores } from "./services/or-audit";
import { generateAuditPdfReport, generateOrdersCampaignPdf } from "./services/audit-report-pdf";
import { buildCalculatedItemResults, buildProcessResults } from "./services/calculated-audits";
import { PRE_DELIVERY_DOCUMENTARY_BLOCK, buildPreDeliveryAuditItems, buildPreDeliveryTemplateItems } from "./services/pre-delivery-audit";
import { auth, googleProvider } from "./firebase";
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
const FullReportView = React.lazy(() => import("./components/reports/FullReportView").then((module) => ({ default: module.FullReportView })));
const StockControlView = React.lazy(() => import("./components/views/StockControlView").then((module) => ({ default: module.StockControlView })));
import { AuditSessionView } from "./components/views/AuditSessionView";
import { AuditStaffSelectionView } from "./components/views/AuditStaffSelectionView";
import { 
  QUICK_AUDIT_MODE_STORAGE_KEY, 
  USER_PROFILE_STORAGE_KEY, 
  INTEGRATION_META_STORAGE_KEY, 
  SYNC_META_STORAGE_KEY, 
  EXPORT_META_STORAGE_KEY
} from "./config/storage-keys";
import { 
  buildAuditBatchName, 
  createEmptyAuditedFileNames, 
  getStoredMeta, 
  buildGroupedHistory, 
  persistMeta, 
  getDefaultQuickAuditMode,
  formatAuditMonthLabel
} from "./utils/audit-helpers";


import { ErrorBoundary } from "./components/ui/ErrorBoundary";

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
  const [lastCompletedAuditReport, setLastCompletedAuditReport] = useState<CompletedAuditReport | null>(null);
  const [auditEntryTab, setAuditEntryTab] = useState<"areas" | "scores">("areas");
  const [auditScope, setAuditScope] = useState<"general" | "individual" | null>(null);
  const [, setShowBatchReportModal] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ show: boolean; auditId: string; auditIds?: string[]; auditName: string; auditSource?: AuditSource; isDeleting?: boolean; error?: string | null }>({ show: false, auditId: "", auditName: "", isDeleting: false, error: null });
  const [deleteReason, setDeleteReason] = useState("");
  const [toastNotification, setToastNotification] = useState<{ message: string; tone?: "success" | "error" } | null>(null);
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
  const [isAuditConfigured, setIsAuditConfigured] = useState(false);
  const lastAutomaticHistorySyncRef = React.useRef("");
  const [userProfile, setUserProfile] = useState<AuditUserProfile>(() => {
    if (typeof window === "undefined") {
      return "auditor";
    }

    const storedProfile = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY);
    return storedProfile === "supervisor" || storedProfile === "consulta" ? storedProfile : "auditor";
  });
  const [isSessionStarted, setIsSessionStarted] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return Boolean(window.localStorage.getItem(USER_PROFILE_STORAGE_KEY));
  });
  // Sheets es la fuente de datos de auditoría. Firebase queda desacoplado de este flujo.
  const isFirebaseEnabled = false;

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
  const hasSyncError = lastSyncMessage.toLowerCase().includes("error");
  const syncStatusTone: "success" | "warning" | "neutral" = isSyncing
    ? "warning"
    : hasSyncError
      ? "warning"
      : hasWebhookUrl
        ? "success"
        : hasSheetCsvUrl
          ? "warning"
          : "neutral";
  const syncStatusLabel = isSyncing
    ? "Leyendo Sheets"
    : hasSyncError
      ? "Cache local"
      : hasWebhookUrl
        ? "Sheets conectado"
        : hasSheetCsvUrl
          ? "CSV verificado"
          : "Sin configurar";
  const syncStatusDetail = isSyncing
    ? "Actualizando datos en vivo"
    : hasSyncError
      ? "Ultimo intento con error"
      : lastSyncAt
        ? `Ultimo sync ${new Date(lastSyncAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`
        : hasWebhookUrl
          ? "Esperando primera lectura"
          : hasSheetCsvUrl
            ? "Fuente externa lista"
            : "Sin enlace a Sheets";
  const {
    history,
    localAuditHistory,
    isUsingExternalHistory,
    historySyncModeLabel,
    upsertLocalAuditHistory,
    dismissAuditHistoryItem,
    removeLocalAuditHistoryItem,
    deleteRemoteAudit,
    refreshExternalHistory,
  } = useAuditSync({
    isAuthReady,
    user,
    hasWebhookUrl,
    webhookUrl,
    hasSheetCsvUrl,
    getTemplateItems: (role: string, location: string) => {
      const scope = (location === "Salta" || location === "Jujuy") ? location : "global";
      const categories = auditCategoryScopes[scope] || auditCategoryScopes.global;
      return categories.find(c => c.name === role)?.items || [];
    },
  });




  const {
    selectedStructureScope,
    setSelectedStructureScope,
    auditCategoryScopes,
    calculationRules,
    handleToggleCalculationLink,
    processDefinitions,
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
    newCategoryStaff,
    setNewCategoryStaff,
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
    handleToggleItemResponsibleRole,
    handleResetStructure,
    handleLoadStructureFromCloud,
    handleSaveStructureToCloud,
    handleSaveStructureToSheet,
    handleLoadStructureFromSheet,
    isLoadingStructureFromSheet,
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
  const groupedHistory = React.useMemo(() => buildGroupedHistory(history), [history]);
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredHistory = normalizedSearchTerm
    ? groupedHistory.filter((audit) =>
        [
          audit.staffName,
          audit.location,
          audit.orderNumber,
          audit.auditBatchName,
          audit.role,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearchTerm))
      )
    : groupedHistory;
  const historyAverageScore = Math.round(filteredHistory.reduce((acc, item) => acc + item.totalScore, 0) / (filteredHistory.length || 1));
  const nonCompliantAudits = filteredHistory.filter((item) => item.totalScore < 90).length;
  const latestHistoryItem = [...groupedHistory].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
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
  const isGlobalAudit = selectedRole === "General";
  const selectedAuditItems = (isGlobalAudit
    ? auditCategories.flatMap((category) => category.items.map((item) => ({ ...item, block: category.name })))
    : [...(selectedAuditCategory?.items ?? [])].sort((left, right) => {
        const leftOrder = left.order ?? getQuestionOrder(left.text);
        const rightOrder = right.order ?? getQuestionOrder(right.text);
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        return left.text.localeCompare(right.text);
      }))
    .filter((item) => item.active !== false);  // Helper for case-insensitive role matching
  // Helper for case-insensitive role matching and keyword detection
  const matchesRole = (role: string | null, target: string, keywords: string[] = []) => {
    if (!role) return false;
    const normalizedRole = role.trim().toLowerCase();
    const normalizedTarget = target.trim().toLowerCase();
    return normalizedRole === normalizedTarget || keywords.some(k => normalizedRole.includes(k.toLowerCase()));
  };
  const usesFlatAuditFlow = matchesRole(selectedRole, "Subgerente de servicio");
  const shouldAutoConfigureRole = (roleName: string, staffOptions: string[] = []) => {
    const isSpecialFlow = ["Ordenes", "Asesores de servicio", "Técnicos", "Pre Entrega", "General"].includes(roleName);
    return !isSpecialFlow && staffOptions.length <= 1;
  };

  const isOrdersAudit = matchesRole(selectedRole, "Ordenes", ["ordenes", "or postventa"]);
  const isServiceAdvisorAudit = matchesRole(selectedRole, "Asesores de servicio");
  const isWorkshopManagerAudit = matchesRole(selectedRole, "Jefe de Taller", ["jefe"]);
  const isTechnicianAudit = matchesRole(selectedRole, "Técnicos", ["técnico", "taller"]) && !isWorkshopManagerAudit;
  const isPreDeliveryAudit = matchesRole(selectedRole, "Pre Entrega", ["pdi", "pre entrega"]);
  const auditedFileNames = Array.from({ length: 6 }, (_, index) => session.auditedFileNames?.[index] ?? "");
  const trimmedAuditedFileNames = auditedFileNames.map((name) => name.trim());
  const preDeliveryAuditItems = isPreDeliveryAudit
    ? buildPreDeliveryTemplateItems(selectedAuditItems, auditedFileNames)
    : [];
  const displayedAuditItems = isPreDeliveryAudit ? preDeliveryAuditItems : selectedAuditItems;
  const activeCalculationRules = calculationRules.filter((rule) => (
    rule.scope === 'global' || rule.scope === session.location
  ));
  const calculationResultsByItemId = React.useMemo(() => {
    if (!selectedRole) {
      return {};
    }

    return buildCalculatedItemResults({
      session: { ...session, role: selectedRole } as AuditSession,
      history,
      categories: auditCategories,
      rules: activeCalculationRules,
    });
  }, [activeCalculationRules, auditCategories, history, selectedRole, session]);
  const activeProcessDefinitions = processDefinitions.filter((definition) => (
    definition.scope === 'global' || definition.scope === session.location
  ));
  const processResults = React.useMemo(() => buildProcessResults({
    session: session as AuditSession,
    history,
    categories: auditCategories,
    definitions: activeProcessDefinitions,
    rules: activeCalculationRules,
  }), [activeProcessDefinitions, auditCategories, history, session]);

  const calculatedSessionItems = displayedAuditItems
    .filter((item) => item.calculationMode === 'calculated')
    .map((item) => {
      const result = calculationResultsByItemId[item.id];
      return {
        id: item.id,
        question: item.text,
        category: selectedRole || 'General',
        status: 'calculated' as const,
        description: item.description,
        responsibleRoles: item.responsibleRoles,
        sector: item.sector,
        weight: item.weight,
        allowsNa: item.allowsNa,
        calculatedScore: result?.score ?? undefined,
        calculationState: result?.state ?? 'pending',
        calculationDetail: result?.detail ?? 'Pendiente de reglas de cálculo',
        scoreLinks: item.scoreLinks,
        scoreAreas: item.scoreAreas,
      };
    });
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
  const availableAuditBlocks = Array.from(new Set(displayedAuditItems.map((item) => item.block).filter(Boolean))) as string[];
  const visibleAuditItems = isPreDeliveryAudit
    ? preDeliverySection === "general"
      ? preDeliveryGeneralItems
      : activePreDeliveryLegajoItems
    : isOrdersAudit
      ? displayedAuditItems
    : usesFlatAuditFlow
      ? displayedAuditItems
    : activeAuditBlock 
      ? displayedAuditItems.filter(item => item.block === activeAuditBlock)
      : isGlobalAudit
        ? displayedAuditItems.filter(item => item.block === (activeAuditBlock || auditCategories[0]?.name))
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
          const templateItems = isPreDeliveryAudit ? preDeliveryAuditItems : selectedAuditItems;
          
          const validItems = sourceItems.filter((item) => item.status && item.status !== "na");
          if (validItems.length === 0) {
            return 0;
          }

          const totalWeight = validItems.reduce((acc, item) => {
            const template = templateItems.find(t => t.id === item.id || t.text === item.question);
            return acc + (template?.weight ?? item.weight ?? 1);
          }, 0);

          const obtainedWeight = validItems
            .filter((item) => item.status === "pass")
            .reduce((acc, item) => {
              const template = templateItems.find(t => t.id === item.id || t.text === item.question);
              return acc + (template?.weight ?? item.weight ?? 1);
            }, 0);
            
          return totalWeight > 0 ? Math.round((obtainedWeight / totalWeight) * 100) : 0;
        })(),
        obtainedWeight: (isPreDeliveryAudit ? sessionPreDeliveryItems : sessionItems)
          .filter(i => i.status === "pass")
          .reduce((acc, item) => {
            const template = (isPreDeliveryAudit ? preDeliveryAuditItems : selectedAuditItems).find(t => t.id === item.id || t.text === item.question);
            return acc + (template?.weight ?? item.weight ?? 1);
          }, 0),
        totalApplicableWeight: (isPreDeliveryAudit ? sessionPreDeliveryItems : sessionItems)
          .filter(i => i.status && i.status !== "na")
          .reduce((acc, item) => {
            const template = (isPreDeliveryAudit ? preDeliveryAuditItems : selectedAuditItems).find(t => t.id === item.id || t.text === item.question);
            return acc + (template?.weight ?? item.weight ?? 1);
          }, 0),
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
  const isCalculatedTemplateItem = (item: AuditTemplateItem) => item.calculationMode === 'calculated';
  const manualAuditItems = displayedAuditItems.filter((item) => !isCalculatedTemplateItem(item));
  const pendingAuditItems = manualAuditItems.filter(
    (auditItem) => !sessionItems.some((item) => (item.id === auditItem.id || item.question === auditItem.text) && item.status)
  );
  const requiredPendingItems = pendingAuditItems.filter((auditItem) => auditItem.required);
  const requiredPendingCount = requiredPendingItems.length;
  const optionalPendingCount = pendingAuditItems.length - requiredPendingCount;
  const resolvedCalculatedCount = calculatedSessionItems.filter((item) => typeof item.calculatedScore === 'number').length;
  const answeredAuditItemCount = manualAuditItems.length - pendingAuditItems.length + resolvedCalculatedCount;
  const applicableAnsweredCount = manualAuditItems.filter((auditItem) => {
    const answer = sessionItems.find((item) => item.id === auditItem.id || item.question === auditItem.text);
    return answer?.status === 'pass' || answer?.status === 'fail';
  }).length + resolvedCalculatedCount;
  const failItemsWithoutCommentCount = manualAuditItems.filter((auditItem) => {
    if (!auditItem.requiresCommentOnFail) {
      return false;
    }

    const answeredItem = sessionItems.find((item) => item.id === auditItem.id || item.question === auditItem.text);
    return answeredItem?.status === 'fail' && !answeredItem.comment?.trim();
  }).length;
  const isSubmitDisabled = answeredAuditItemCount === 0 || requiredPendingCount > 0 || isSendingToSheet || failItemsWithoutCommentCount > 0;
  const canRunAudits = userProfile !== "consulta";
  const canAccessStructure = userProfile === "supervisor";
  const canAccessIntegrations = userProfile === "supervisor";
  const resumeDraftSession = React.useCallback((draft: IncompleteAuditListItem) => {
    setSession({
      id: draft.id,
      date: draft.date,
      auditBatchName: draft.auditBatchName,
      sampleTarget: draft.sampleTarget,
      selectedStaffNames: draft.selectedStaffNames,
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
    setIsAuditConfigured(Boolean(draft.role));
    setView(draft.role ? "audit" : "setup");
  }, []);

  const handleEditAudit = React.useCallback((audit: AuditSession) => {
    if (!canRunAudits) {
      alert("El perfil Consulta no puede editar auditorías.");
      return;
    }
    // Si la auditoría tiene auditorías hijas (ej. lote de varias ORs), tomamos la primera para editar o la auditoría directa
    const sourceAudit = audit.childAudits?.[0] ?? audit;
    const editableRole = sourceAudit.role || sourceAudit.items[0]?.category || audit.role || null;
    const cleanStaffName = (sourceAudit.staffName || sourceAudit.participants?.asesorServicio || audit.staffName || "").trim();
    // Limpiar número de orden si viene con "2 OR" etc. de agrupados
    let cleanOrderNumber = (sourceAudit.orderNumber || audit.orderNumber || "").trim();
    if (cleanOrderNumber.includes("OR")) {
      const numericMatch = cleanOrderNumber.match(/\d{2,10}/);
      cleanOrderNumber = numericMatch ? numericMatch[0] : "";
    }

    setSession({
      id: sourceAudit.id,
      date: sourceAudit.date,
      auditBatchName: sourceAudit.auditBatchName || audit.auditBatchName,
      sampleTarget: sourceAudit.sampleTarget || audit.sampleTarget,
      selectedStaffNames: sourceAudit.selectedStaffNames || audit.selectedStaffNames,
      auditorId: sourceAudit.auditorId || audit.auditorId,
      location: sourceAudit.location || audit.location,
      staffName: cleanStaffName,
      orderNumber: cleanOrderNumber,
      clientIdentifier: sourceAudit.clientIdentifier || audit.clientIdentifier,
      auditedFileNames: sourceAudit.auditedFileNames || audit.auditedFileNames,
      notes: sourceAudit.notes || audit.notes,
      participants: {
        ...(audit.participants || {}),
        ...(sourceAudit.participants || {}),
        asesorServicio: cleanStaffName,
      },
      items: (sourceAudit.items && sourceAudit.items.length > 0) ? sourceAudit.items : (audit.items ?? []),
    });
    setSelectedRole(editableRole);
    setSelectedStaff(cleanStaffName);
    setActiveAuditItemId(null);
    setFocusedAuditItemId(null);
    setSelectedAudit(null);
    setView(editableRole ? "audit" : "setup");
    setIsAuditConfigured(Boolean(editableRole));
  }, [canRunAudits]);

  const advisorGoal = session.sampleTarget || 30;
  
  const currentBatchOrderAudits = React.useMemo(() => {
    const recordsById = new Map<string, AuditSession>();
    const currentBatchName = session.auditBatchName?.trim();

    [...history, ...completedAuditReports.map((report) => report.session)].forEach((audit) => {
      const isOrder = audit.entityType === "or" || String(audit.role || "").toLowerCase().includes("orden");
      const belongsToCurrentBatch = currentBatchName
        ? audit.auditBatchName?.trim() === currentBatchName
        : audit.date === session.date && audit.location === session.location;

      if (isOrder && belongsToCurrentBatch) {
        recordsById.set(audit.id, audit);
      }
    });

    return Array.from(recordsById.values())
      .sort((left, right) => `${right.date}-${right.id}`.localeCompare(`${left.date}-${left.id}`));
  }, [completedAuditReports, history, session.auditBatchName, session.date, session.location]);

  const orderStaffProgress = React.useMemo(() => {
    const counts = new Map<string, number>();
    currentBatchOrderAudits.forEach((audit) => {
      const name = audit.staffName?.trim() || audit.participants?.asesorServicio?.trim();
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    });
    return Array.from(counts, ([advisorName, sampledCount]) => ({ advisorName, sampledCount }));
  }, [currentBatchOrderAudits]);

  const sampledOrdersProgress = React.useMemo(() => {
    const count = currentBatchOrderAudits.length;
    return Math.min(100, Math.round((count / advisorGoal) * 100));
  }, [advisorGoal, currentBatchOrderAudits.length]);

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
  const groupedHistoryAudits = buildGroupedHistory(history);
  const incompletedHistoryAudits: IncompleteAuditListItem[] = groupedHistoryAudits
    .filter((auditSession) => {
      const scopeKey = (auditSession.location === "Salta" || auditSession.location === "Jujuy")
        ? auditSession.location
        : "global";
      const expectedCategories = (auditCategoryScopes[scopeKey] || auditCategoryScopes.global)
        .filter((category) => category.name.trim() && category.items.length > 0)
        .map((category) => category.name);
      const completedRoles = new Set(
        (auditSession.childAudits || [auditSession])
          .map((childAudit) => childAudit.role?.trim())
          .filter(Boolean)
      );

      return completedRoles.size > 0 && completedRoles.size < expectedCategories.length;
    })
    .map((auditSession) => {
      const scopeKey = (auditSession.location === "Salta" || auditSession.location === "Jujuy")
        ? auditSession.location
        : "global";
      const expectedCategories = (auditCategoryScopes[scopeKey] || auditCategoryScopes.global)
        .filter((category) => category.name.trim() && category.items.length > 0);
      const childAudits = auditSession.childAudits || [auditSession];
      const sourceAudit = childAudits.find((childAudit) =>
        Boolean(childAudit.location || childAudit.auditorId || childAudit.staffName || childAudit.auditBatchName)
      ) || childAudits[0];

      return {
        id: auditSession.id,
        childAuditIds: auditSession.childAuditIds,
        childAudits,
        expectedChildCount: expectedCategories.length,
        date: sourceAudit?.date || auditSession.date,
        auditBatchName: sourceAudit?.auditBatchName || auditSession.auditBatchName || "Auditoria de proceso",
        auditorId: sourceAudit?.auditorId || auditSession.auditorId,
        location: sourceAudit?.location || auditSession.location,
        role: "Auditoria de proceso",
        staffName: sourceAudit?.staffName || auditSession.staffName,
        items: auditSession.items,
        updatedAt: sourceAudit?.date || auditSession.date,
        _source: "history" as const,
        totalScore: auditSession.totalScore,
        notes: sourceAudit?.notes || auditSession.notes,
        participants: sourceAudit?.participants || auditSession.participants,
      };
    });

  // Combinar borradores reales + auditorías incompletas del historial
  const allIncompleteAudits: IncompleteAuditListItem[] = [...realDraftAudits, ...incompletedHistoryAudits]
    .sort((left, right) => (right.updatedAt || "").localeCompare(left.updatedAt || ""));

  // Mostrar pendientes solamente cuando hay auditorías que se pueden retomar
  const updatedSidebarItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    ...(canRunAudits ? [{ id: "setup", label: "Nueva Auditoría", icon: Plus }] : []),
    ...(allIncompleteAudits.length > 0 ? [{ id: "continuar", label: "Auditorías pendientes", icon: Activity }] : []),
    { id: "history", label: "Registro y seguimiento", icon: History },
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
  });

  const { handleTopbarBack } = useHashNavigation({
    view,
    selectedRole,
    availableRoles: ["General", ...allAuditAreaNames],
    setView,
    setSelectedRole,
    clearSelectedRole,
    startNewAudit,
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
    if (view !== "audit" || isOrdersAudit || isPreDeliveryAudit || usesFlatAuditFlow) {
      return;
    }

    if (isGlobalAudit) {
      if (!activeAuditBlock || !availableAuditBlocks.includes(activeAuditBlock)) {
        setActiveAuditBlock(availableAuditBlocks[0] ?? null);
      }
      return;
    }

    if (availableAuditBlocks.length <= 1) {
      if (activeAuditBlock !== null) {
        setActiveAuditBlock(null);
      }
      return;
    }

    if (!activeAuditBlock || !availableAuditBlocks.includes(activeAuditBlock)) {
      setActiveAuditBlock(availableAuditBlocks[0]);
    }
  }, [activeAuditBlock, availableAuditBlocks, isGlobalAudit, isOrdersAudit, isPreDeliveryAudit, usesFlatAuditFlow, view]);

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

    if (view === "setup" || view === "audit" || view === "home" || view === "structure" || view === "integrations" || view === "stock-control") {
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

    if (selectedAudit && !filteredHistory.some((item: any) => item.id === selectedAudit.id)) {
      setSelectedAudit(null);
    }
  }, [filteredHistory, selectedAudit, view]);

  useEffect(() => {
    if (!hasWebhookUrl || (view !== "history" && view !== "continuar")) {
      return;
    }

    const syncKey = `${view}:${webhookUrl.trim()}`;
    if (lastAutomaticHistorySyncRef.current === syncKey && history.length > 0) {
      return;
    }

    lastAutomaticHistorySyncRef.current = syncKey;
    void refreshExternalHistory()
      .then((externalAudits) => {
        const timestamp = new Date().toISOString();
        const syncMessage = externalAudits.length > 0
          ? `Historial actualizado automaticamente desde Sheets (${externalAudits.length} registros).`
          : "Sheets respondio correctamente, pero no devolvio registros.";

        persistMeta(SYNC_META_STORAGE_KEY, { timestamp, message: syncMessage });
        setLastSyncAt(timestamp);
        setLastSyncMessage(syncMessage);
      })
      .catch((error) => {
        console.error("Automatic history sync failed:", error);
      });
  }, [hasWebhookUrl, history.length, refreshExternalHistory, view, webhookUrl]);

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
    setView("dashboard");
    setIsSessionStarted(true);
  };

  const handleStartNewAudit = React.useCallback(() => {
    // El acceso debe abrir siempre el primer paso, aunque el usuario venga de una ruta anterior.
    setView("setup");
    setAuditScope(null);
    startNewAudit();
    if (typeof window !== "undefined" && window.location.hash !== "#/nueva") {
      window.history.replaceState(null, "", "#/nueva");
    }
    contentContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [startNewAudit]);
  const handleNavigate = React.useCallback((nextView: AppView | "home") => {
    setIsMobileNavOpen(false);

    if (nextView === "setup") {
      handleStartNewAudit();
      return;
    }

    if (nextView === "home") {
      setView("dashboard");
      return;
    }

    if (nextView === "history") {
      setSelectedAudit(null);
    }

    setView(nextView);
  }, [handleStartNewAudit]);
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
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
    }
    setIsSessionStarted(false);
    setView("dashboard");
  };

  const handleDeleteAudit = React.useCallback(async (auditId: string, _auditSource?: AuditSource, auditIds?: string[], reason?: string) => {
    if (!canRunAudits) {
      alert("El perfil Consulta no puede eliminar auditorías.");
      return;
    }
    const targetAuditIds = auditIds?.length ? auditIds : [auditId];

    setDeleteConfirmModal((prev) => ({ ...prev, isDeleting: true, error: null }));

    try {
      if (hasWebhookUrl) {
        // Si hay webhook configurado, siempre intentamos eliminar/archivar en Google Sheets
        await Promise.all(
          targetAuditIds.map((targetAuditId) =>
            deleteRemoteAudit(targetAuditId, {
              userEmail: user?.email || "Usuario Local",
              reason: reason || "Eliminación manual desde Historial",
            })
          )
        );
      }

      // Descartar del estado local y de drafts
      targetAuditIds.forEach((targetAuditId) => {
        dismissAuditHistoryItem(targetAuditId);
        removeDraftAudit(targetAuditId);
        removeLocalAuditHistoryItem(targetAuditId);
      });

      setCompletedAuditReports((current) =>
        current.filter((report) => !targetAuditIds.includes(report.session.id))
      );

      setDeleteConfirmModal({ show: false, auditId: "", auditName: "", isDeleting: false, error: null });
      setDeleteReason("");
      setToastNotification({ message: "Auditoría eliminada y archivada correctamente en Sheets", tone: "success" });
      setTimeout(() => setToastNotification(null), 2800);
    } catch (err: any) {
      console.error("Error al eliminar auditoría:", err);
      setDeleteConfirmModal((prev) => ({
        ...prev,
        isDeleting: false,
        error: err?.message || "No se pudo eliminar en Google Sheets. Revisa la conexión.",
      }));
    }
  }, [canRunAudits, deleteRemoteAudit, dismissAuditHistoryItem, hasWebhookUrl, removeDraftAudit, removeLocalAuditHistoryItem, user?.email]);

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleAuditSubmit = (submitMode: OrdersSubmitMode = "finish") => {
    if (isSendingToSheet) return;
    if (!selectedRole || (!selectedAuditCategory && !isGlobalAudit)) return;

    if (isOrdersAudit && !/^\d{2,10}$/.test(session.orderNumber?.trim() || "")) {
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

    if (requiredPendingCount > 0) {
      const firstPending = requiredPendingItems[0];
      if (firstPending) {
        setActiveAuditItemId(firstPending.id);
        setFocusedAuditItemId(firstPending.id);
      }
      alert(`Faltan ${requiredPendingCount} requisito(s) obligatorio(s) por responder antes del cierre.`);
      return;
    }
    if (applicableAnsweredCount === 0) {
      alert("No hay requisitos aplicables evaluados. No se puede calcular un puntaje confiable si todo quedó como N/A.");
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
    if (isSendingToSheet) return;
    submitAudit(pendingOrdersSubmitMode);
  };


  const focusAuditItem = (auditItem: AuditTemplateItem) => {
    setActiveAuditItemId(auditItem.id);
    setFocusedAuditItemId(auditItem.id);
  };


  const submitAudit = async (submitMode: OrdersSubmitMode = "finish") => {
    if (isSendingToSheet) return;
    if (sessionItems.length === 0 && calculatedSessionItems.length === 0) return;

    setIsSendingToSheet(true);

    const normalizedSession = ensureSessionMetadata(session);

    const genericFinalItems = [
      ...sessionItems.filter((item) => item.status !== "calculated"),
      ...calculatedSessionItems,
    ];
    const finalItems = isOrdersAudit
      ? sessionOrderItems
      : isPreDeliveryAudit
        ? sessionPreDeliveryItems
        : genericFinalItems;    const complianceMetrics = calculateAuditCompliance(finalItems);
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
          templateItems: visibleAuditItems,
          auditorName,
          submittedByEmail: user?.email,
        });

        await sendAuditToWebhook(webhookUrl, payload);
        await refreshExternalHistory();
        savedRemotely = true;
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

      setLastCompletedAuditReport({
        role: completeSession.role || selectedRole!,
        session: completeSession,
        auditorName,
        templateItems: displayedAuditItems,
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
      if (submitMode === "continue") {
        setIsAuditConfigured(false);
      }
      setSession({
        id: createClientId(),
        date: completeSession.date,
        auditBatchName: completeSession.auditBatchName,
        sampleTarget: completeSession.sampleTarget,
        selectedStaffNames: completeSession.selectedStaffNames,
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

    if (status === "na" && templateItem?.allowsNa === false) {
      return;
    }
    
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
          weight: templateItem?.weight ?? 1,
          allowsNa: templateItem?.allowsNa,
          scoreLinks: templateItem?.scoreLinks,
          scoreAreas: templateItem?.scoreLinks?.map((link) => link.area) ?? templateItem?.scoreAreas,
        });
      }
    }

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
        status: undefined,
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
        status: undefined,
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
        syncStatusLabel={syncStatusLabel}
        syncStatusDetail={syncStatusDetail}
        syncStatusTone={syncStatusTone}
        isSyncing={isSyncing}
        authenticationEnabled={isFirebaseEnabled}
        showSidebar={view === "dashboard" || view === "history" || view === "structure" || view === "integrations" || view === "continuar" || view === "setup" || view === "stock-control"}
        sidebarItems={updatedSidebarItems}
        isMobileNavOpen={isMobileNavOpen}
        canRunAudits={canRunAudits}
        contentContainerRef={contentContainerRef}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onOpenMobileNav={() => setIsMobileNavOpen(true)}
        onCloseMobileNav={() => setIsMobileNavOpen(false)}
        onBack={() => {
          if (selectedRole === "General") setAuditScope(null);
          handleTopbarBack();
        }}
        onStartAudit={handleStartNewAudit}
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
                {lastCompletedAuditReport && (
                  <Button
                    variant="secondary"
                    className="mb-3 w-full h-14 rounded-2xl text-xs font-black uppercase tracking-widest"
                    onClick={() => generateAuditPdfReport({
                      appTitle,
                      session: lastCompletedAuditReport.session,
                      auditorName: lastCompletedAuditReport.auditorName || "Auditor",
                      templateItems: lastCompletedAuditReport.templateItems || [],
                    })}
                  >
                    Descargar PDF gerencial
                  </Button>
                )}
                <Button
                  className="w-full h-14 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-500/20"
                  onClick={() => setShowSuccessModal(false)}
                >
                  Listo
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
                <DashboardView history={history} onOpenHistory={() => setView("history")} />
              </Suspense>
            </motion.div>
          )}



          {view === "stock-control" && (
            <motion.div
              key="stock-control"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Suspense fallback={<div className="rounded-[1.8rem] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500">Cargando control físico...</div>}>
                <StockControlView
                  auditors={AUDITORS}
                  defaultAuditorId={session.auditorId}
                  defaultLocation={session.location ?? "Jujuy"}
                  defaultBatchName={session.auditBatchName || auditBatchDisplayName}
                  defaultDate={session.date}
                  webhookUrl={webhookUrl}
                  onBack={() => setView("audit")}
                  onSaved={(audit) => {
                    upsertLocalAuditHistory(audit);
                    void refreshExternalHistory();
                  }}
                />
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
                  onAuditNameChange={(auditBatchName) => setSession((current) => ({ ...current, auditBatchName }))}
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
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 tracking-tight">
                        {auditBatchDisplayName || "Selección de Auditoría"}
                      </h2>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">
                        {session.location || "Sin sucursal"} · Auditor: {selectedAuditorOption?.name || "Sin asignar"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="inline-grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                        <button
                          type="button"
                          onClick={() => setAuditEntryTab("areas")}
                          className={cn(
                            "rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition",
                            auditEntryTab === "areas" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                          )}
                        >
                          Áreas
                        </button>
                        <button
                          type="button"
                          onClick={() => setAuditEntryTab("scores")}
                          className={cn(
                            "rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition",
                            auditEntryTab === "scores" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                          )}
                        >
                          Resumen
                        </button>
                      </div>
                    </div>
                  </div>



                  {auditEntryTab === "areas" ? (
                    auditScope === null ? (
                      <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-3 md:grid-cols-2">
                        <button type="button" onClick={() => {
                          setAuditScope("general");
                          setSession((previous) => ({
                            id: createClientId(),
                            date: previous.date || new Date().toISOString().split("T")[0],
                            auditBatchName: previous.auditBatchName,
                            auditorId: previous.auditorId,
                            location: previous.location,
                            auditedFileNames: createEmptyAuditedFileNames(),
                            participants: { asesorServicio: "", tecnico: "", controller: "", lavador: "", repuestos: "" },
                            items: [],
                          }));
                          setSelectedRole("General");
                          setSelectedStaff("Auditoría Integral");
                          setIsAuditConfigured(true);
                          setActiveAuditBlock(auditCategories[0]?.name || null);
                        }} className="group flex min-h-[82px] items-center gap-4 rounded-2xl border border-[#cddce8] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#34769a] hover:shadow-md">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#001e50] text-white"><LayoutDashboard className="h-5 w-5" /></span>
                          <span className="min-w-0 flex-1"><strong className="block text-sm text-[#001e50]">Auditoría integral</strong><small className="mt-1 block text-[11px] leading-5 text-slate-500">Todas las áreas dentro de una sola auditoría.</small></span>
                          <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1" />
                        </button>
                        <button type="button" onClick={() => setAuditScope("individual")} className="group flex min-h-[82px] items-center gap-4 rounded-2xl border border-[#cddce8] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#34769a] hover:shadow-md">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eaf4fb] text-[#21678f]"><FileCheck className="h-5 w-5" /></span>
                          <span className="min-w-0 flex-1"><strong className="block text-sm text-[#001e50]">Auditoría por área</strong><small className="mt-1 block text-[11px] leading-5 text-slate-500">Elegí un área; después podés volver y auditar otra.</small></span>
                          <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1" />
                        </button>
                      </div>
                    ) : (
                    <div className="space-y-4">
                      <div className="flex items-end justify-between gap-4">
                        <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">Auditoría por área</p><h3 className="mt-1 text-lg font-black text-[#001e50]">Elegí qué vas a auditar</h3><p className="mt-1 text-xs text-slate-500">Sólo se abrirá el área seleccionada.</p></div>
                        <button type="button" onClick={() => setAuditScope(null)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600 hover:border-blue-300">Cambiar tipo</button>
                      </div>
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
                        // Cada área inicia su propia evaluación. Así, si el auditor vuelve
                        // a Áreas, las respuestas, el colaborador y la OR anteriores no se
                        // mezclan con la nueva auditoría; el avance previo queda como borrador.
                        setSession((previous) => ({
                          id: createClientId(),
                          date: previous.date || new Date().toISOString().split("T")[0],
                          auditBatchName: category.name === "Ordenes"
                            ? previous.auditBatchName?.replace("Auditoria de procesos", "Auditoría OR")
                            : previous.auditBatchName,
                          sampleTarget: category.name === "Ordenes" ? (previous.sampleTarget || 30) : previous.sampleTarget,
                          selectedStaffNames: previous.selectedStaffNames,
                          auditorId: previous.auditorId,
                          location: previous.location,
                          auditedFileNames: createEmptyAuditedFileNames(),
                          participants: {
                            asesorServicio: "",
                            tecnico: "",
                            controller: "",
                            lavador: "",
                            repuestos: "",
                          },
                          items: [],
                        }));
                        setSelectedStaff("");
                        setIsAuditConfigured(false);
                        setSelectedRole(category.name);
                        setAuditEntryTab("areas");
                        
                        if (category.name === "General") {
                          setIsAuditConfigured(true);
                          setSelectedStaff("Auditoría Integral");
                          setActiveAuditBlock(auditCategories[0]?.name || null);
                          return;
                        }

                        const blocks = Array.from(new Set(category.items.map(i => i.block).filter(Boolean))) as string[];
                        setActiveAuditBlock(blocks.length > 0 ? blocks[0] : null);

                        if (shouldAutoConfigureRole(category.name, category.staffOptions)) {
                          const autoStaff = category.staffOptions[0]?.trim() || category.name;
                          setSelectedStaff(autoStaff);
                          setSession((prev) => ({
                            ...prev,
                            staffName: autoStaff,
                          }));
                          setIsAuditConfigured(true);
                          return;
                        }

                        if (category.name === "Pre Entrega") {
                          setSelectedStaff("");
                        }
                      }}
                    />
                    </div>
                    )
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
                      <Button variant="secondary" size="lg" onClick={() => setView("report")} className="border-slate-200 bg-white text-slate-900 hover:bg-slate-50">
                        <FileText className="h-4 w-4" />
                        Generar reporte
                      </Button>
                    </div>
                  )}
                </div>
              ) : selectedRole && (
                !isAuditConfigured || 
                (!selectedStaff && selectedRole !== "General") || 
                (isOrdersAudit && !/^\d{2,10}$/.test(session.orderNumber?.trim() || "") && !isAuditConfigured) || 
                (isServiceAdvisorAudit && (!session.clientIdentifier || !session.orderNumber) && !isAuditConfigured)
              ) && !isPreDeliveryAudit ? (
                <AuditStaffSelectionView
                  role={selectedRole}
                  staffList={
                    selectedAuditCategory?.staffOptions?.length
                      ? selectedAuditCategory.staffOptions
                      : STAFF[selectedRole as keyof typeof STAFF] || []
                  }
                  selectedStaff={selectedStaff}
                  onSelectStaff={setSelectedStaff}
                  orderNumber={session.orderNumber}
                  onOrderNumberChange={(value) => {
                    setIsAuditConfigured(false);
                    setSession((prev) => ({ ...prev, orderNumber: value }));
                  }}
                  clientIdentifier={session.clientIdentifier}
                  onClientIdentifierChange={(value) => setSession((prev) => ({ ...prev, clientIdentifier: value }))}
                  onContinue={() => {
                    setSession(prev => ({
                      ...prev,
                      staffName: selectedStaff,
                      participants: isOrdersAudit ? {
                        ...prev.participants,
                        asesorServicio: selectedStaff,
                      } : prev.participants
                    }));
                    setIsAuditConfigured(true);
                  }}
                  onBack={clearSelectedRole}
                  isOrdersAudit={isOrdersAudit}
                  isServiceAdvisorAudit={isServiceAdvisorAudit}
                  isTechnicianAudit={isTechnicianAudit}
                  staffProgress={orderStaffProgress}
                  sampleTarget={session.sampleTarget || 30}
                  selectedStaffNames={session.selectedStaffNames || []}
                  onSampleTargetChange={(sampleTarget) => setSession((prev) => ({ ...prev, sampleTarget }))}
                  onSelectedStaffNamesChange={(selectedStaffNames) => setSession((prev) => ({ ...prev, selectedStaffNames }))}
                  orderAudits={currentBatchOrderAudits}
                  onViewOrderAudit={setSelectedAudit}
                  onEditOrderAudit={handleEditAudit}
                  onPrintOrderAudit={(audit) => generateAuditPdfReport({
                    appTitle,
                    session: audit,
                    auditorName: AUDITORS.find((auditor) => auditor.id === audit.auditorId)?.name || "Auditor",
                    templateItems: selectedAuditItems,
                  })}
                  onSaveOrdersCampaign={clearSelectedRole}
                  onFinishOrdersCampaign={clearSelectedRole}
                  onPrintOrdersCampaign={() => generateOrdersCampaignPdf({
                    appTitle,
                    audits: currentBatchOrderAudits,
                    auditorName: AUDITORS.find((auditor) => auditor.id === session.auditorId)?.name || "Auditor",
                    sampleTarget: session.sampleTarget || 30,
                  })}
                  onOpenPhysicalStockControl={selectedRole === "Repuestos" ? () => setView("stock-control") : undefined}
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
                    isGlobalAudit={isGlobalAudit}
                    visibleAuditItems={visibleAuditItems}
                    calculationResultsByItemId={calculationResultsByItemId}
                    processResults={processResults}
                    activeAuditBlock={activeAuditBlock}
                    setActiveAuditBlock={setActiveAuditBlock}
                    availableBlocks={usesFlatAuditFlow ? [] : availableAuditBlocks}
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
                    requiredPendingCount={requiredPendingCount}
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
                    completedOrderCount={currentBatchOrderAudits.length}
                    recentStaffAudits={completedAuditReports.filter(r => r.session.staffName?.trim() === selectedStaff?.trim() && r.role === selectedRole)}
                    onOpenPhysicalStockControl={selectedRole === "Repuestos" ? () => setView("stock-control") : undefined}
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
                  isLoadingStructureFromSheet={isLoadingStructureFromSheet}
                  isSavingStructureToSheet={isSavingStructureToSheet}
                  hasPendingStructureChanges={hasPendingStructureChanges}
                  handleLoadStructureFromCloud={handleLoadStructureFromCloud}
                  handleSaveStructureToCloud={handleSaveStructureToCloud}
                  handleSaveStructureToSheet={handleSaveStructureToSheet}
                  handleLoadStructureFromSheet={handleLoadStructureFromSheet}
                  handleResetStructure={handleResetStructure}
                  auditCategories={auditCategories}
                  calculationRules={calculationRules}
                  handleToggleCalculationLink={handleToggleCalculationLink}
                  selectedStructureCategory={selectedStructureCategory}
                  selectedStructureCategoryId={selectedStructureCategoryId}
                  setSelectedStructureCategoryId={setSelectedStructureCategoryId}
                  handleDuplicateCategory={handleDuplicateCategory}
                  handleDeleteCategory={handleDeleteCategory}
                  handleDeleteItem={handleDeleteItem}
                  updateCategory={updateCategory}
                  newCategoryName={newCategoryName}
                  setNewCategoryName={setNewCategoryName}
                  newCategoryDescription={newCategoryDescription}
                  setNewCategoryDescription={setNewCategoryDescription}
                  newCategoryStaff={newCategoryStaff}
                  setNewCategoryStaff={setNewCategoryStaff}
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
                  handleToggleItemResponsibleRole={handleToggleItemResponsibleRole}
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
                  selectedHistoryAudit={selectedAudit}
                  historyAverageScore={historyAverageScore}
                  nonCompliantAudits={nonCompliantAudits}
                  latestHistoryItem={latestHistoryItem}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  onBack={() => setView("dashboard")}
                  onSelectAudit={setSelectedAudit}
                  onEditAudit={handleEditAudit}
                  onExportCsv={exportToCSV}
                  onSyncData={syncData}
                  onDeleteAudit={(audit) => setDeleteConfirmModal({ show: true, auditId: audit.id, auditIds: audit.childAuditIds, auditName: audit.auditBatchName || audit.staffName || "Auditoria sin nombre", auditSource: audit.source })}
                  isSyncing={isSyncing}
                  isHistorySyncConfigured={isHistorySyncConfigured}
                  canManageRecords={canRunAudits}
                  isUsingExternalHistory={isUsingExternalHistory}
                  hasWebhookUrl={hasWebhookUrl}
                  hasSheetCsvUrl={hasSheetCsvUrl}
                  totalHistoryCount={groupedHistory.length}
                  historySyncModeLabel={historySyncModeLabel}
                  localAuditHistoryCount={localAuditHistory.length}
                  lastSyncAt={lastSyncAt}
                  lastExportedAt={lastExportedAt}
                  lastSyncMessage={lastSyncMessage}
                  pendingAudits={allIncompleteAudits}
                  onResumePending={handleResumeIncompleteAudit}
                  onDeletePending={handleRequestDeleteIncompleteAudit}
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

      {/* Full Report View */}
      {view === "report" && (
        <div className="fixed inset-0 z-[100] bg-white overflow-y-auto print:static print:z-auto">
          <Suspense fallback={<div className="p-10 text-center text-sm font-bold text-slate-500">Cargando reporte...</div>}>
            <FullReportView
              appTitle={appTitle}
              completedReports={completedAuditReports}
              auditCategories={auditCategories}
              overallScore={blendedProcessCompliance}
              getSectionScores={getSectionScores}
              onClose={() => setView("dashboard")}
            />
          </Suspense>
        </div>
      )}

      <AnimatePresence>
        {selectedAudit && (() => {
          const childAudits = selectedAudit.childAudits && selectedAudit.childAudits.length > 0
            ? selectedAudit.childAudits
            : [selectedAudit];
          const hasMultipleChildren = childAudits.length > 1;
          const displayAudit = childAudits[0] ?? selectedAudit;
          const displayedItems = (displayAudit.items && displayAudit.items.length > 0)
            ? displayAudit.items
            : (selectedAudit.items ?? []);
          const roleLabel = displayAudit.role || displayAudit.items?.[0]?.category || selectedAudit.role || "Auditoría";
          const score = selectedAudit.totalScore ?? displayAudit.totalScore ?? 0;
          const passedCount = displayedItems.filter((i) => i.status === "pass").length;
          const failedCount = displayedItems.filter((i) => i.status === "fail").length;
          const naCount = displayedItems.filter((i) => i.status === "na").length;

          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedAudit(null)}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl flex flex-col max-h-[90vh] z-10"
              >
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-100 bg-slate-50/70 flex justify-between items-start gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-600" />
                      <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Detalle de Inspección</p>
                      {hasMultipleChildren && (
                        <span className="rounded-md bg-blue-100/80 px-2 py-0.5 text-[9px] font-black uppercase text-blue-800">
                          Lote ({childAudits.length} evaluaciones)
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight truncate">
                      {roleLabel}
                    </h3>
                    <p className="text-slate-500 text-xs font-semibold flex items-center gap-2">
                      <span>{displayAudit.date}</span>
                      <span>•</span>
                      <span>{displayAudit.location || "Sin sucursal"}</span>
                      {selectedAudit.source === "sheet" && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-700 font-bold">Sheets</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className={cn(
                      "h-16 w-16 rounded-2xl flex flex-col items-center justify-center font-black border",
                      score >= 90 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : 
                      score >= 70 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-rose-200 bg-rose-50 text-rose-700"
                    )}>
                      <span className="text-[9px] uppercase tracking-wider opacity-75">Score</span>
                      <span className="text-xl font-black">{score}%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAudit(null)}
                      className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                      title="Cerrar"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Sub-audits tabs if grouped */}
                {hasMultipleChildren && (
                  <div className="flex gap-2 overflow-x-auto p-3 bg-slate-100/70 border-b border-slate-200/60 custom-scrollbar">
                    {childAudits.map((child, index) => (
                      <button
                        key={child.id || index}
                        type="button"
                        onClick={() => setSelectedAudit(child)}
                        className={cn(
                          "rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap border",
                          (selectedAudit.id === child.id || (!selectedAudit.childAuditIds && index === 0))
                            ? "bg-white text-blue-700 border-blue-200 shadow-sm"
                            : "bg-transparent text-slate-600 border-transparent hover:bg-white/60"
                        )}
                      >
                        {child.orderNumber ? `OR ${child.orderNumber}` : `Evaluación ${index + 1}`}
                        <span className="ml-1.5 opacity-60">({child.totalScore}%)</span>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  {/* Meta cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Responsable</p>
                      <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">{displayAudit.staffName || "No especificado"}</p>
                    </div>
                    {displayAudit.orderNumber && (
                      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3.5 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-blue-600">Nº de Orden</p>
                        <p className="text-xs sm:text-sm font-black text-blue-800 truncate">{displayAudit.orderNumber}</p>
                      </div>
                    )}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cumplimiento</p>
                      <p className="text-xs sm:text-sm font-black text-emerald-700">{passedCount} de {displayedItems.length} ítems</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Desvíos / NA</p>
                      <p className="text-xs sm:text-sm font-black text-rose-700">{failedCount} desvío{failedCount === 1 ? "" : "s"} · {naCount} N/A</p>
                    </div>
                  </div>

                  {/* Checklist detail */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Puntos Evaluados ({displayedItems.length})</p>
                    </div>

                    {displayedItems.length > 0 ? (
                      <div className="space-y-2.5">
                        {displayedItems.map((item, idx) => {
                          const isPass = item.status === "pass";
                          const isFail = item.status === "fail";
                          return (
                            <div 
                              key={idx} 
                              className={cn(
                                "p-4 rounded-2xl border transition space-y-2",
                                isPass ? "border-slate-100 bg-white" :
                                isFail ? "border-rose-100 bg-rose-50/30" : "border-slate-100 bg-slate-50/50"
                              )}
                            >
                              <div className="flex justify-between items-start gap-4">
                                <div className="space-y-1 min-w-0">
                                  {item.category && item.category !== roleLabel && (
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                                      {item.category}
                                    </span>
                                  )}
                                  <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug">{item.question}</p>
                                </div>
                                <span className={cn(
                                  "text-[10px] font-black uppercase px-2.5 py-1 rounded-lg shrink-0 border",
                                  isPass ? "bg-emerald-50 text-emerald-700 border-emerald-200" : 
                                  isFail ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-100 text-slate-600 border-slate-200"
                                )}>
                                  {isPass ? "Cumple" : isFail ? "No Cumple" : "N/A"}
                                </span>
                              </div>
                              {item.comment && (
                                <div className="pl-3 border-l-2 border-slate-300 bg-slate-50/80 p-2 rounded-r-xl">
                                  <p className="text-[11px] text-slate-600 font-medium italic leading-relaxed">"{item.comment}"</p>
                                </div>
                              )}
                              {item.photoUrl && (
                                <div className="flex items-center gap-2 pt-1">
                                  <a 
                                    href={item.photoUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition"
                                  >
                                    <Camera className="h-3 w-3" />
                                    Ver evidencia fotográfica
                                    <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs font-bold text-slate-400">
                        Esta evaluación no contiene ítems individuales registrados.
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {displayAudit.notes && (
                    <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-1">
                      <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider">Observaciones Generales</p>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium">{displayAudit.notes}</p>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                  {canRunAudits && (
                    <button 
                      type="button"
                      onClick={() => {
                        const auditToEdit = displayAudit;
                        setSelectedAudit(null);
                        handleEditAudit(auditToEdit);
                      }}
                      className="flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-slate-700 bg-white hover:bg-slate-100 transition border border-slate-200 flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Pencil className="h-4 w-4 text-blue-600" />
                      Editar / Recalcular
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => setSelectedAudit(null)}
                    className="flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 transition shadow-sm"
                  >
                    Cerrar
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
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
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl space-y-6 z-10"
            >
              <div className="text-center">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-4">
                  <Trash2 className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Eliminar Auditoría</h3>
                <p className="text-slate-500 font-medium text-xs mt-1">¿Estás seguro de que deseas eliminar este registro?</p>
              </div>

              <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 text-center">
                <p className="text-[10px] font-black text-rose-600 uppercase tracking-wider mb-1">Registro</p>
                <p className="text-sm font-black text-slate-800 break-words">{deleteConfirmModal.auditName}</p>
              </div>

              {deleteConfirmModal.error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 text-center">
                  {deleteConfirmModal.error}
                </div>
              )}

              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Motivo de eliminación (opcional)
                </label>
                <input
                  type="text"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Ej: Prueba, error de carga, duplicado..."
                  disabled={deleteConfirmModal.isDeleting}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-rose-400 focus:bg-white"
                />
              </div>

              <div className="flex gap-3">
                <button
                  disabled={deleteConfirmModal.isDeleting}
                  onClick={() => {
                    setDeleteConfirmModal({ show: false, auditId: "", auditName: "", isDeleting: false, error: null });
                    setDeleteReason("");
                  }}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-100 font-black text-xs uppercase tracking-wider text-slate-600 hover:bg-slate-200 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  disabled={deleteConfirmModal.isDeleting}
                  onClick={() => void handleDeleteAudit(deleteConfirmModal.auditId, deleteConfirmModal.auditSource, deleteConfirmModal.auditIds, deleteReason)}
                  className="flex-1 px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 font-black text-xs uppercase tracking-wider text-white transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deleteConfirmModal.isDeleting ? (
                    <>
                      <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Borrando...</span>
                    </>
                  ) : (
                    "Eliminar"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification flotante rápido */}
      <AnimatePresence>
        {toastNotification && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white/95 backdrop-blur-md px-5 py-3.5 shadow-xl shadow-slate-900/10 text-slate-800"
          >
            <div className="h-8 w-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-900 leading-tight">Operación exitosa</p>
              <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{toastNotification.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setToastNotification(null)}
              className="ml-2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
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
