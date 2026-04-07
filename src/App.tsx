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
  Save,
  History,
  Plus,
  ArrowLeft,
  UserCheck,
  Wrench,
  ShieldCheck,
  Droplets,
  FileCheck,
  Package,
  Truck,
  ClipboardList,
  ChevronDown,
  FileText,
  Settings,
  LayoutDashboard,
  Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AppShell } from "./app/AppShell";
import { AppStartGate } from "./app/AppStartGate";
import { cn, createClientId } from "./lib/utils";
import { buildAuditSyncPayload, sendAuditToWebhook } from "./services/audit-sync";
import { 
  LOCATIONS, 
  AUDITORS,
  OR_PARTICIPANTS,
  STAFF,
} from "./constants";
import { AppView, AuditSession, AuditTemplateItem, AuditUserProfile, HistoryPanel, IncompleteAuditListItem, Location, Role } from "./types";
import { buildOrderAuditItems, calculateAuditCompliance, calculateRoleScores } from "./services/or-audit";
import { buildAuditHistorySummary, buildAuditProcessMetrics } from "./services/audit-metrics";
import { PRE_DELIVERY_DOCUMENTARY_BLOCK, buildPreDeliveryAuditItems, buildPreDeliveryTemplateItems } from "./services/pre-delivery-audit";
import { auth, googleProvider, isFirebaseConfigured } from "./firebase";
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from "firebase/auth";
import Papa from "papaparse";
import { AuditItemRow } from "./components/audit/AuditItemRow";
import { Button } from "./components/ui/Button";
import { AppModal } from "./components/ui/Modal";
import { useAuditDrafts } from "./hooks/useAuditDrafts";
import { useHashNavigation } from "./hooks/useHashNavigation";
import { useAuditStructure } from "./hooks/useAuditStructure";
import { useAuditSync } from "./hooks/useAuditSync";
import { useAuditSessionActions } from "./hooks/useAuditSessionActions";

const DashboardView = React.lazy(() => import("./components/views/DashboardView").then((module) => ({ default: module.DashboardView })));
const HistoryView = React.lazy(() => import("./components/history/HistoryView").then((module) => ({ default: module.HistoryView })));
const StructurePanel = React.lazy(() => import("./components/reports/StructurePanel").then((module) => ({ default: module.StructurePanel })));
const IntegrationsView = React.lazy(() => import("./components/views/IntegrationsView").then((module) => ({ default: module.IntegrationsView })));
const ContinueAuditsView = React.lazy(() => import("./components/views/ContinueAuditsView").then((module) => ({ default: module.ContinueAuditsView })));
const HomeView = React.lazy(() => import("./components/views/HomeView").then((module) => ({ default: module.HomeView })));
const SetupView = React.lazy(() => import("./components/views/SetupView").then((module) => ({ default: module.SetupView })));
const AuditLandingView = React.lazy(() => import("./components/views/AuditLandingView").then((module) => ({ default: module.AuditLandingView })));

function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error, setError] = React.useState<any>(null);

  React.useEffect(() => {
    const handleError = (e: ErrorEvent) => setError(e.error);
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
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

interface CompletedAuditReport {
  role: Role;
  session: AuditSession;
  auditorName: string;
  templateItems: AuditTemplateItem[];
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
  const envWebhookUrl = import.meta.env.VITE_APPS_SCRIPT_URL?.trim() || "";
  const envSheetCsvUrl = import.meta.env.VITE_SHEET_CSV_URL?.trim() || "";
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
  const [lastSyncMessage, setLastSyncMessage] = useState<string>(storedSyncMeta?.message || "TodavÃ­a no se ejecutÃ³ ninguna sincronizaciÃ³n manual.");
  const [lastExportedAt, setLastExportedAt] = useState<string | null>(storedExportMeta?.timestamp ?? null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [focusedAuditItemId, setFocusedAuditItemId] = useState<string | null>(null);
  const [activeAuditItemId, setActiveAuditItemId] = useState<string | null>(null);
  const [completedAuditReports, setCompletedAuditReports] = useState<CompletedAuditReport[]>([]);
  const [auditEntryTab, setAuditEntryTab] = useState<"areas" | "scores">("areas");
  const [showBatchReportModal, setShowBatchReportModal] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ show: boolean; auditId: string; auditName: string }>({ show: false, auditId: "", auditName: "" });
  const [preDeliverySection, setPreDeliverySection] = useState<"general" | "legajos">("general");
  const [preDeliveryActiveLegajoIndex, setPreDeliveryActiveLegajoIndex] = useState(0);
  const [draftSaveState, setDraftSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [isQuickAuditMode, setIsQuickAuditMode] = useState<boolean>(() => getDefaultQuickAuditMode());
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
    const parsedDate = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
    const monthLabel = new Intl.DateTimeFormat("es-AR", { month: "long" }).format(parsedDate).trim();
    return monthLabel ? monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1) : "Mes";
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
  const isHistorySyncConfigured = hasWebhookUrl || hasSheetCsvUrl;
  const {
    history,
    localAuditHistory,
    isUsingExternalHistory,
    historySyncModeLabel,
    upsertLocalAuditHistory,
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
    handleDeleteCategory,
    handleAddItem,
    handleResetStructure,
    handleLoadStructureFromCloud,
    handleSaveStructureToCloud,
  } = useAuditStructure({
    isAuthReady,
    isCloudStructureAvailable: isFirebaseEnabled,
    hasAuthenticatedUser: Boolean(user),
    userEmail: user?.email,
    selectedRole,
    setSelectedRole,
    setSelectedStaff,
    sessionLocation: session.location,
  });

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
  const isOrdersAudit = selectedRole === "Ordenes";
  const isServiceAdvisorAudit = selectedRole === "Asesores de servicio";
  const isTechnicianAudit = selectedRole === "Técnicos";
  const isPreDeliveryAudit = selectedRole === "Pre Entrega";
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
    const separatorIndex = question.indexOf(" · ");
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
  const canGoToPreviousLegajo = preDeliveryActiveLegajoIndex > 0;
  const canGoToNextLegajo = preDeliveryActiveLegajoIndex < preDeliveryLegajoCards.length - 1;
  const visibleAuditItems = isPreDeliveryAudit
    ? preDeliverySection === "general"
      ? preDeliveryGeneralItems
      : activePreDeliveryLegajoItems
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
  const selectedAuditStaffOptions = selectedAuditCategory?.staffOptions ?? [];
  const sessionParticipants = session.participants ?? {
    asesorServicio: "",
    tecnico: "",
    controller: "",
    lavador: "",
    repuestos: "",
  };
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
    : selectedRole === "Lavadero"
      ? [
          "Falta limpieza",
          "Detalle incompleto",
          "No coincide con estándar",
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
  const nextPendingLegajoIndex = React.useMemo(() => {
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
  const currentLegajoCompleted = isPreDeliveryAudit
    && preDeliverySection === "legajos"
    && activePreDeliveryLegajoItems.length > 0
    && activePreDeliveryLegajoItems.every((auditItem) => isAuditItemAnswered(auditItem));
  const ORDERS_TARGET_PER_ADVISOR = 10;
  const SERVICE_ADVISOR_TARGET_CLIENTS = 2;
  const currentAuditBatchName = session.auditBatchName?.trim() || "";
  const selectedAuditorOption = AUDITORS.find((auditor) => auditor.id === session.auditorId) ?? null;
  const auditBatchDisplayName = session.auditBatchName?.trim() || (session.location
    ? buildAuditBatchName(
        session.location,
        session.date,
        history
          .filter((auditSession) => auditSession.location === session.location && auditSession.date.startsWith((session.date || "").slice(0, 7)) && auditSession.auditBatchName?.trim())
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
  const {
    filteredHistory,
    recentAudits,
    historyAverageScore,
    nonCompliantAudits,
    latestHistoryItem,
  } = buildAuditHistorySummary({
    history,
    searchTerm,
  });
  const selectedHistoryAudit = view === "history" ? selectedAudit : null;
  const {
    sampledOrdersAdvisorProgress,
    completedOrdersAdvisorsCount,
    sampledOrdersProgress,
    sampledServiceAdvisorProgress,
    completedServiceAdvisorTargetsCount,
    sampledServiceAdvisorClientsProgress,
    blendedServiceAdvisorScoreRows,
    blendedTechnicianScoreRows,
    areaScoreRows,
    technicianReviewSessions,
  } = buildAuditProcessMetrics({
    history,
    completedSessions: completedAuditReports.map((report) => report.session),

    sessionDate: session.date,
    sessionLocation: session.location,
    currentAuditBatchName,
    auditCategories,
    configuredOrderAdvisorNames: OR_PARTICIPANTS.asesorServicio,
    configuredServiceAdvisorNames: STAFF["Asesores de servicio"] ?? [],
  });
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

  // Filtrar solo borradores reales (excluir auditor�as ya guardadas en historial)
  const completedSessionIds = new Set([
    ...history.map((h) => h.id),
    ...completedAuditReports.map((r) => r.session.id),
  ]);

  const realDraftAudits = sortedDraftAudits.filter((draft) => !completedSessionIds.has(draft.id));

  // Obtener auditor�as incompletas del historial (< 100%)
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

  // Combinar borradores reales + auditor�as incompletas del historial
  const allIncompleteAudits: IncompleteAuditListItem[] = [...realDraftAudits, ...incompletedHistoryAudits]
    .sort((left, right) => (right.updatedAt || "").localeCompare(left.updatedAt || ""));

  // Actualizar sidebarItems para incluir "Continuar Auditor�a" solo si hay borradores reales
  const updatedSidebarItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    ...(canRunAudits ? [{ id: "home", label: "Nueva Auditor�a", icon: Plus }] : []),
    ...(allIncompleteAudits.length > 0 ? [{ id: "continuar", label: "Continuar Auditor�a", icon: Activity }] : []),
    { id: "history", label: "Historial", icon: History },
    ...(canAccessStructure ? [{ id: "structure", label: "Estructura", icon: Settings }] : []),
    ...(canAccessIntegrations ? [{ id: "integrations", label: "Integraciones", icon: ShieldCheck }] : []),
  ];

  const technicianDraftSessions = realDraftAudits
    .filter((draft) => (draft.role || draft.items[0]?.category) === "Técnicos")
    .sort((left, right) => `${right.date}-${right.id}`.localeCompare(`${left.date}-${left.id}`));

  const {
    ensureSessionMetadata,
    clearSelectedRole,
    handleResumeTechnicianEvaluation,
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
    clearSelectedRole,
  });

  const getAuditItemStatusLabel = (status?: "pass" | "fail" | "na") => {
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
      const answers = items.map((templateItem) => auditSession.items.find((sessionItem) => sessionItem.question === templateItem.text));
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

    if (!selectedAudit || !filteredHistory.some((item) => item.id === selectedAudit.id)) {
      setSelectedAudit(filteredHistory[0]);
    }
  }, [filteredHistory, selectedAudit, view]);

  const saveIntegrationSettings = () => {
    localStorage.setItem("webhookUrl", webhookUrl.trim());
    localStorage.setItem("sheetCsvUrl", sheetCsvUrl.trim());
    const timestamp = new Date().toISOString();
    persistMeta(INTEGRATION_META_STORAGE_KEY, {
      timestamp,
      message: "Configuracion de integraciones actualizada.",
    });
    setLastIntegrationSavedAt(timestamp);
    alert("Configuracion guardada correctamente.");
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
        alert("El navegador bloqueó la ventana de acceso. Permití popups e intentá de nuevo.");
      } else if (error.code === 'auth/unauthorized-domain') {
        alert("Este dominio no está habilitado. Agregalo en Firebase Authentication > Settings > Authorized domains.");
      } else if (error.code === 'auth/operation-not-allowed') {
        alert("Google no está habilitado como método de acceso en Firebase Authentication.");
      } else if (error.code === 'auth/invalid-api-key') {
        alert("La configuración de Firebase es inválida. Revisá la API key del proyecto.");
      } else {
        alert("No se pudo iniciar sesión con Google. Revisá la configuración de Firebase Authentication.");
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
    setCompletedAuditReports((current) =>
      current.filter((report) => report.session.id !== auditId)
    );
    setDeleteConfirmModal({ show: false, auditId: "", auditName: "" });
  }, [removeDraftAudit]);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingOrdersSubmitMode, setPendingOrdersSubmitMode] = useState<OrdersSubmitMode>("finish");

  const handleAuditSubmit = (submitMode: OrdersSubmitMode = "finish") => {
    if (!selectedRole || !selectedAuditCategory) return;

    if (selectedRole === "Ordenes" && !/^\d{6}$/.test(session.orderNumber?.trim() || "")) {
      alert("Ingresá un número de OR válido de 6 dígitos.");
      return;
    }

    if (selectedRole === "Ordenes" && !session.participants?.asesorServicio?.trim()) {
      alert("Completá el asesor de servicio antes de cerrar la OR.");
      return;
    }

    if (selectedRole === "Asesores de servicio" && !selectedStaff.trim()) {
      alert("Seleccioná el asesor de servicio antes de cerrar la auditoría.");
      return;
    }

    if (selectedRole === "Asesores de servicio" && !session.clientIdentifier?.trim()) {
      alert("Ingresá el nombre o VIN del cliente auditado.");
      return;
    }

    if (selectedRole === "Técnicos" && !selectedStaff.trim()) {
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

  const focusAuditItem = (auditItem: AuditTemplateItem) => {
    setActiveAuditItemId(auditItem.id);
    setFocusedAuditItemId(auditItem.id);
  };

  const goToNextPendingLegajo = React.useCallback(() => {
    if (nextPendingLegajoIndex === null) {
      return;
    }

    setPreDeliverySection("legajos");
    setPreDeliveryActiveLegajoIndex(nextPendingLegajoIndex);

    const nextLegajoCard = preDeliveryLegajoCards[nextPendingLegajoIndex];
    if (!nextLegajoCard?.trimmedName) {
      return;
    }

    const blockTitle = `Legajo auditado ${nextPendingLegajoIndex + 1}: ${nextLegajoCard.trimmedName}`;
    const nextLegajoItems = displayedAuditItems.filter((item) => item.block === blockTitle);
    const nextPendingItem = findNextPendingAuditItem(sessionItems, nextLegajoItems) ?? nextLegajoItems[0] ?? null;
    if (nextPendingItem) {
      focusAuditItem(nextPendingItem);
    }
  }, [displayedAuditItems, findNextPendingAuditItem, nextPendingLegajoIndex, preDeliveryLegajoCards, sessionItems]);

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
      staffName: selectedRole === "Ordenes"
        ? session.participants?.asesorServicio || selectedStaff
        : selectedRole === "Asesores de servicio"
          ? selectedStaff.trim()
        : isPreDeliveryAudit
          ? undefined
          : selectedStaff,
      role: selectedRole!,
      orderNumber: selectedRole === "Ordenes" ? session.orderNumber?.trim() || undefined : undefined,
      clientIdentifier: selectedRole === "Asesores de servicio" ? session.clientIdentifier?.trim() || undefined : undefined,
      auditedFileNames: isPreDeliveryAudit ? auditedFileNames.map((name) => name.trim()) : undefined,
      totalScore: complianceMetrics.compliance,
      items: finalItems,
      participants: session.participants,
      roleScores,
      entityType: selectedRole === "Ordenes" ? "or" : "general",
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
    let syncWarning: string | null = null;

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
          syncWarning = "La auditoría se envió, pero no quedó guardada en la persistencia secundaria.";
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
      setSelectedStaff(shouldKeepServiceAdvisor ? (completeSession.staffName?.trim() || "") : "");
      setView("audit");
      setSession({
        id: createClientId(),
        date: completeSession.date,
        auditBatchName: completeSession.auditBatchName,
        auditorId: completeSession.auditorId,
        location: completeSession.location,
        clientIdentifier: undefined,
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

      if (!savedRemotely) {
        alert("Auditoría guardada en este dispositivo.");
      } else if (syncWarning) {
        alert(syncWarning);
      } else if (hasWebhookUrl) {
        alert("Auditoría guardada correctamente.");
      }
    } catch (error) {
      console.error("Submit audit failed:", error);

      const errorMessage = error instanceof Error ? error.message : String(error);

      upsertLocalAuditHistory(completeSession);

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
      setSelectedStaff(shouldKeepServiceAdvisor ? (completeSession.staffName?.trim() || "") : "");
      setView("audit");
      setSession({
        id: createClientId(),
        date: completeSession.date,
        auditBatchName: completeSession.auditBatchName,
        auditorId: completeSession.auditorId,
        location: completeSession.location,
        clientIdentifier: undefined,
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

      if (isFirebaseEnabled && (errorMessage.includes("Missing or insufficient permissions") || errorMessage.includes("insufficient permissions"))) {
        const shouldLogin = window.confirm("Se guardó en este dispositivo. Firebase rechazó el acceso. ¿Querés iniciar sesión con Google ahora?");
        if (shouldLogin) {
          void handleLogin();
        }
        return;
      }

      if (isFirebaseEnabled && errorMessage.includes("authInfo") && errorMessage.includes('"userId":undefined')) {
        const shouldLogin = window.confirm("Se guardó en este dispositivo. No hay una sesión activa. ¿Querés iniciar sesión con Google ahora?");
        if (shouldLogin) {
          void handleLogin();
        }
        return;
      }

      if (hasWebhookUrl) {
        alert(`No se pudo enviar la auditoría a Apps Script. Se guardó en este dispositivo.\n\nDetalle: ${errorMessage}`);
        return;
      }

      alert("La auditoría se guardó en este dispositivo.");
    }
  };

  const toggleItemStatus = (question: string, status: "pass" | "fail" | "na") => {
    const existingIndex = session.items?.findIndex(i => i.question === question) ?? -1;
    const newItems = [...(session.items ?? [])];
    const templateItem = displayedAuditItems.find((auditItem) => auditItem.text === question);
    
    if (existingIndex >= 0) {
      newItems[existingIndex] = { ...newItems[existingIndex], status };
    } else {
      newItems.push({
        id: templateItem?.id || createClientId(),
        question,
        category: selectedRole!,
        status,
        comment: "",
        description: templateItem?.description,
        responsibleRoles: templateItem?.responsibleRoles,
        sector: templateItem?.sector,
        weight: templateItem?.weight,
        allowsNa: templateItem?.allowsNa,
      });
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
        status: "na",
        comment,
        description: templateItem?.description,
        responsibleRoles: templateItem?.responsibleRoles,
        sector: templateItem?.sector,
        weight: templateItem?.weight,
        allowsNa: templateItem?.allowsNa,
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
        photoUrl,
      });
    }

    setSession({ ...session, items: newItems });
  };

  const syncData = async () => {
    if (!isHistorySyncConfigured) {
      alert("Configurá Apps Script o una URL CSV publicada para sincronizar datos.");
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
      alert("No se pudo leer la fuente CSV publicada. Revisá la URL y el acceso público.");
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
        showSidebar={view === "dashboard" || view === "history" || view === "structure" || view === "integrations" || view === "continuar"}
        sidebarItems={updatedSidebarItems}
        isMobileNavOpen={isMobileNavOpen}
        canRunAudits={canRunAudits}
        contentContainerRef={contentContainerRef}
        onNavigate={(nextView) => {
          if (nextView === "home") {
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
      >
        <AnimatePresence mode="wait">
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

          {view === "home" && (
            <motion.div
              key="home-refactor"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <Suspense fallback={<div className="rounded-[1.8rem] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500">Cargando cabina...</div>}>
                <HomeView
                  isLoggingIn={isLoggingIn}
                  isSyncing={isSyncing}
                  isSheetSyncConfigured={isSheetSyncConfigured}
                  isHistorySyncConfigured={isHistorySyncConfigured}
                  historySyncModeLabel={historySyncModeLabel}
                  hasWebhookUrl={hasWebhookUrl}
                  hasSheetCsvUrl={hasSheetCsvUrl}
                  isUsingExternalHistory={isUsingExternalHistory}
                  isFirebaseEnabled={isFirebaseEnabled}
                  hasUser={Boolean(user)}
                  localAuditHistoryCount={localAuditHistory.length}
                  historyCount={history.length}
                  recentAudits={recentAudits}
                  onStartAudit={startNewAudit}
                  onSyncData={syncData}
                  onOpenHistory={() => setView("history")}
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
                <>
                  <Suspense fallback={<div className="rounded-[1.6rem] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500">Cargando cabina de auditoria...</div>}>
                    <AuditLandingView
                      auditBatchDisplayName={auditBatchDisplayName}
                      selectedAuditorName={selectedAuditorOption?.name}
                      selectedLocation={session.location}
                      dateLabel={session.date}
                      auditEntryTab={auditEntryTab}
                      onChangeAuditEntryTab={setAuditEntryTab}
                      auditCategories={auditCategories}
                      completedAuditReports={completedAuditReports}
                      sampledOrdersProgress={sampledOrdersProgress}
                      sampledServiceAdvisorClientsProgress={sampledServiceAdvisorClientsProgress}
                      blendedServiceAdvisorScoreRows={blendedServiceAdvisorScoreRows}
                      blendedTechnicianScoreRows={blendedTechnicianScoreRows}
                      areaScoreRows={areaScoreRows}
                      onSelectCategory={(categoryName) => {
                        setSelectedRole(categoryName);
                        setAuditEntryTab("areas");
                        if (categoryName === "Pre Entrega" || categoryName === "Ordenes") {
                          setSelectedStaff("");
                        }
                      }}
                      canGenerateReport={completedAuditReports.length > 0}
                      onGenerateReport={() => setShowBatchReportModal(true)}
                    />
                  </Suspense>
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
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-2.5 xl:grid-cols-6 xl:gap-3">
                      {auditCategories.map((category) => {
                        const completedCategoryReport = completedAuditReports.find((report) => report.role === category.name);
                        const isOrdersCategory = category.name === "Ordenes";
                        const isServiceAdvisorCategory = category.name === "Asesores de servicio";
                        const categoryProgress = isOrdersCategory
                          ? sampledOrdersProgress
                          : isServiceAdvisorCategory
                            ? sampledServiceAdvisorClientsProgress
                          : completedCategoryReport?.session.totalScore;
                        const isCategoryTracked = typeof categoryProgress === "number";

                        return (
                        <button
                          key={category.id}
                          onClick={() => {
                            setSelectedRole(category.name);
                            setAuditEntryTab("areas");
                            if (category.name === "Pre Entrega" || category.name === "Ordenes") {
                              setSelectedStaff("");
                            }
                          }}
                          className={cn(
                            "px-4 py-4 rounded-[1.7rem] border shadow-sm flex flex-col items-center justify-center gap-2.5 group transition-all active:scale-95 lg:items-start lg:text-left lg:min-h-[132px]",
                            isCategoryTracked
                              ? "border-emerald-200 bg-emerald-50/90 hover:border-emerald-300"
                              : "border-gray-100 bg-white hover:border-blue-200 hover:shadow-md"
                          )}
                        >
                          <div className="w-10 h-10 bg-gray-50 rounded-[1rem] flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                            {category.name.includes("Asesor") && <UserCheck className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />}
                            {category.name.includes("Técnico") && <Wrench className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />}
                            {category.name.includes("Jefe") && <ShieldCheck className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />}
                            {category.name.includes("Lavadero") && <Droplets className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />}
                            {category.name.includes("Garantía") && <FileCheck className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />}
                            {category.name.includes("Repuestos") && <Package className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />}
                            {category.name.includes("Pre Entrega") && <Truck className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />}
                            {category.name.includes("Ordenes") && <FileText className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />}
                            {![("Asesor"), ("Técnico"), ("Jefe"), ("Lavadero"), ("Garantía"), ("Repuestos"), ("Pre Entrega"), ("Ordenes")].some(k => category.name.includes(k)) && (
                              <ClipboardList className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <span className={cn("font-bold text-[11px] text-center leading-tight lg:text-sm lg:text-left", isCategoryTracked ? "text-emerald-950" : "text-gray-800")}>{category.name}</span>
                            {isCategoryTracked && (
                              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">{categoryProgress}%</p>
                            )}
                          </div>
                        </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-black text-slate-900">Asesores de servicio</p>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">{blendedServiceAdvisorScoreRows.length} personas</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                                <th className="px-2 py-2">Asesor</th>
                                <th className="px-2 py-2">Áreas incluidas</th>
                                <th className="px-2 py-2 text-center">Resultado</th>
                                <th className="px-2 py-2 text-center">Auditorías</th>
                              </tr>
                            </thead>
                            <tbody>
                              {blendedServiceAdvisorScoreRows.length > 0 ? blendedServiceAdvisorScoreRows.map((row) => (
                                <tr key={`advisor-score-${row.personName}`} className="border-b border-slate-100 last:border-b-0">
                                  <td className="px-2 py-2.5 font-bold text-slate-800">{row.personName}</td>
                                  <td className="px-2 py-2.5 text-xs font-bold text-slate-600">{row.areas.join(" + ")}</td>
                                  <td className="px-2 py-2.5 text-center font-black text-emerald-700">{row.compliance}%</td>
                                  <td className="px-2 py-2.5 text-center font-bold text-slate-600">{row.evaluations}</td>
                                </tr>
                              )) : (
                                <tr>
                                  <td className="px-2 py-3 text-xs font-bold text-slate-500" colSpan={4}>Todavía no hay auditorías de asesores para este proceso (OR y Asesores de servicio).</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-slate-900">Técnicos</p>
                            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Final = promedio simple entre OR y Auditoría Técnicos</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">{blendedTechnicianScoreRows.length} personas</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                                <th className="px-2 py-2">Técnico</th>
                                <th className="px-2 py-2 text-center">OR</th>
                                <th className="px-2 py-2 text-center">Aud. Técnicos</th>
                                <th className="px-2 py-2 text-center">Final</th>
                                <th className="px-2 py-2 text-center">Auditorías</th>
                              </tr>
                            </thead>
                            <tbody>
                              {blendedTechnicianScoreRows.length > 0 ? blendedTechnicianScoreRows.map((row) => (
                                <tr key={`technician-score-${row.personName}`} className="border-b border-slate-100 last:border-b-0">
                                  <td className="px-2 py-2.5 font-bold text-slate-800">{row.personName}</td>
                                  <td className="px-2 py-2.5 text-center font-black text-slate-700">{typeof row.ordersScore === "number" ? `${row.ordersScore}%` : "-"}</td>
                                  <td className="px-2 py-2.5 text-center font-black text-slate-700">{typeof row.technicianAuditScore === "number" ? `${row.technicianAuditScore}%` : "-"}</td>
                                  <td className="px-2 py-2.5 text-center font-black text-emerald-700">{row.compliance}%</td>
                                  <td className="px-2 py-2.5 text-center font-bold text-slate-600">{row.evaluations}</td>
                                </tr>
                              )) : (
                                <tr>
                                  <td className="px-2 py-3 text-xs font-bold text-slate-500" colSpan={5}>Todavía no hay auditorías de técnicos para este proceso.</td>
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
                </>
              ) : (
                <div className="audit-workspace-shell space-y-6">
                <div className="audit-field-mobile-hero lg:hidden rounded-[1.6rem] border border-slate-200 bg-[linear-gradient(135deg,#081222_0%,#12345d_100%)] p-3.5 text-white shadow-[0_14px_34px_rgba(12,35,64,0.18)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Auditoría en campo</p>
                      <h2 className="mt-1.5 text-lg font-black tracking-[-0.03em] text-white">{selectedRole}</h2>
                      <p className="mt-1.5 text-sm font-medium text-slate-300">
                        {isOrdersAudit
                          ? `OR ${session.orderNumber || "sin número"} · ${sessionParticipants.asesorServicio || "Sin asesor"}`
                          : isServiceAdvisorAudit
                            ? `${selectedStaff || "Sin asesor"} · ${session.clientIdentifier?.trim() || "Sin cliente/VIN"}`
                          : isPreDeliveryAudit
                            ? `${auditedFileNames.filter((name) => name.trim()).length}/6 legajos cargados`
                            : (selectedStaff || "Sin personal asignado")}
                      </p>
                      {isOrdersAudit && (
                        <p className="mt-2 text-xs font-medium leading-relaxed text-slate-300">
                          Técnico: {sessionParticipants.tecnico || "-"} · Controller: {sessionParticipants.controller || "-"} · Lavador: {sessionParticipants.lavador || "-"}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedRole(null)}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-200">{sessionItems.length}/{displayedAuditItems.length} respondidos</span>
                    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">{isOrdersAudit ? "OR" : isServiceAdvisorAudit ? "AS" : "Score"} {currentOrCompliance.compliance}%</span>
                  </div>
                </div>

                <div className="audit-workspace-grid grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
                  <div className="audit-workspace-sidebar space-y-3 lg:sticky lg:top-24 h-fit lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-2">
                    <div className={cn(
                      "audit-sidebar-cluster hidden space-y-3 rounded-[1.5rem] lg:block",
                      selectedRole === "Ordenes" ? "bg-[#EEF3F9]/95 backdrop-blur-xl" : "bg-[#F9F9F9] border border-slate-200"
                    )}>
                      <div className={cn(
                        "audit-sidebar-hero flex items-center justify-between rounded-[1.6rem] border px-4 py-3.5 shadow-[0_18px_44px_rgba(12,35,64,0.22)]",
                        selectedRole === "Ordenes"
                          ? "bg-[linear-gradient(135deg,#071225_0%,#0f2d53_58%,#1e4c84_100%)] border-[#214e83] text-white"
                          : "bg-white border-gray-100 text-gray-900"
                      )}>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setSelectedRole(null)}
                            className={cn(
                              "p-2 -ml-2 rounded-full shadow-sm border",
                              selectedRole === "Ordenes"
                                ? "text-slate-200 hover:text-white bg-white/10 border-white/10"
                                : "text-gray-400 hover:text-gray-900 bg-white border-gray-100"
                            )}
                          >
                            <ArrowLeft className="w-5 h-5" />
                          </button>
                          <div>
                            <h2 className="text-base font-bold leading-tight">{selectedRole}</h2>
                            <p className={cn(
                              "text-[10px] uppercase font-black tracking-widest",
                              selectedRole === "Ordenes" ? "text-blue-100/80" : "text-gray-400"
                            )}>
                              {selectedRole === "Ordenes"
                                ? `OR ${session.orderNumber || "sin número"}`
                                : isServiceAdvisorAudit
                                  ? `Cliente/VIN ${session.clientIdentifier?.trim() || "sin dato"}`
                                  : (auditBatchDisplayName || "Auditoría en curso")}
                            </p>
                            {selectedRole === "Ordenes" && (
                              <p className="mt-1.5 max-w-[180px] text-[11px] font-medium leading-relaxed text-blue-100/80">
                                Asesor {sessionParticipants.asesorServicio || "-"} · Técnico {sessionParticipants.tecnico || "-"}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right rounded-xl bg-white/10 px-3 py-2 border border-white/10">
                          <div className={cn(
                            "text-xl font-black leading-none",
                            selectedRole === "Ordenes" ? "text-white" : "text-gray-900"
                          )}>
                            {currentOrCompliance.compliance}%
                          </div>
                          <div className={cn(
                            "text-[10px] font-bold uppercase tracking-tighter",
                            selectedRole === "Ordenes" ? "text-blue-100/80" : "text-gray-400"
                          )}>{selectedRole === "Ordenes" ? "Cumplimiento OR" : isServiceAdvisorAudit ? "Cumplimiento AS" : "Progreso"}</div>
                          <div className={cn(
                            "text-[10px] font-black uppercase tracking-tighter mt-1",
                            selectedRole === "Ordenes" ? "text-cyan-200" : "text-emerald-600"
                          )}>{sessionItems.length}/{displayedAuditItems.length}</div>
                        </div>
                      </div>

                      <div className="audit-sidebar-card space-y-3 rounded-[1.2rem] border border-slate-200 bg-white p-3.5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Avance de checklist</p>
                          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{displayedAuditItems.length > 0 ? Math.round((sessionItems.length / displayedAuditItems.length) * 100) : 0}%</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${displayedAuditItems.length > 0 ? (sessionItems.length / displayedAuditItems.length) * 100 : 0}%` }}
                            className={cn(
                              "h-full rounded-full",
                              selectedRole === "Ordenes" ? "bg-gradient-to-r from-[#1d4f91] via-[#0066b1] to-[#00a3e0]" : "bg-blue-500"
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-lg bg-emerald-50 px-2 py-2 text-center">
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">Cumple</p>
                            <p className="mt-1 text-sm font-black text-emerald-800">{sessionItems.filter(i => i.status === 'pass').length}</p>
                          </div>
                          <div className="rounded-lg bg-red-50 px-2 py-2 text-center">
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-red-700">Desvío</p>
                            <p className="mt-1 text-sm font-black text-red-800">{sessionItems.filter(i => i.status === 'fail').length}</p>
                          </div>
                          <div className="rounded-lg bg-slate-100 px-2 py-2 text-center">
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">N/A</p>
                            <p className="mt-1 text-sm font-black text-slate-700">{sessionItems.filter(i => i.status === 'na').length}</p>
                          </div>
                        </div>
                      </div>

                  </div>

                    {!isOrdersAudit && !isPreDeliveryAudit && (
                      <div className="audit-sidebar-card space-y-2 rounded-[1.3rem] border border-slate-200 bg-white p-3.5 shadow-sm">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Personal Auditado</label>
                        {selectedAuditStaffOptions.length > 0 ? (
                          <div className="relative">
                            <select 
                              value={selectedStaff}
                              onChange={(e) => setSelectedStaff(e.target.value)}
                              className="w-full p-3.5 bg-slate-50 border border-gray-200 rounded-2xl font-bold text-sm appearance-none focus:outline-none shadow-sm"
                            >
                              <option value="">Seleccionar nombre...</option>
                              {selectedAuditStaffOptions.map(name => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={selectedStaff}
                            onChange={(e) => setSelectedStaff(e.target.value)}
                            placeholder="Ingresar nombre"
                            className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3.5 font-bold text-sm focus:outline-none shadow-sm"
                          />
                        )}
                      </div>
                    )}

                    {isTechnicianAudit && (technicianReviewSessions.length > 0 || technicianDraftSessions.length > 0) && (
                      <div className="audit-sidebar-card rounded-[1.3rem] border border-slate-200 bg-white px-3.5 py-3.5 shadow-sm space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Evaluaciones de técnicos</p>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-700">{technicianDraftSessions.length + technicianReviewSessions.length} técnicos</p>
                        </div>
                        <div className="space-y-2">
                          {technicianDraftSessions.map((draft) => (
                            <button
                              key={`technician-draft-${draft.id}`}
                              type="button"
                              onClick={() => resumeDraftSession(draft)}
                              className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-left transition hover:border-amber-300"
                            >
                              <p className="text-xs font-black text-amber-950">{draft.staffName || "Sin nombre"}</p>
                              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">📝 Borrador · {draft.date}</p>
                            </button>
                          ))}
                          {technicianReviewSessions.map((auditSession) => (
                            <button
                              key={`technician-resume-${auditSession.id}`}
                              type="button"
                              onClick={() => handleResumeTechnicianEvaluation(auditSession)}
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition hover:border-slate-300"
                            >
                              <p className="text-xs font-black text-slate-900">{auditSession.staffName}</p>
                              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{auditSession.totalScore}% · {auditSession.date}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {isServiceAdvisorAudit && (
                      <div className="audit-sidebar-card rounded-[1.3rem] border border-slate-200 bg-white px-3.5 py-3.5 shadow-sm space-y-3">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Cliente auditado (Nombre o VIN)</label>
                          <input
                            type="text"
                            value={session.clientIdentifier || ""}
                            onChange={(e) => setSession({ ...session, clientIdentifier: e.target.value })}
                            placeholder="Ej. Juan Perez o 9BWZZZ377VT004251"
                            className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3.5 font-bold text-sm focus:outline-none shadow-sm"
                          />
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                          <div className="mb-2.5 flex items-center justify-between gap-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Avance por asesor</p>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-700">
                              {completedServiceAdvisorTargetsCount}/{sampledServiceAdvisorProgress.length} en objetivo
                            </p>
                          </div>
                          <div className="space-y-2">
                            {sampledServiceAdvisorProgress.map((advisorProgress) => {
                              const completionPercent = Math.min(
                                100,
                                Math.round((advisorProgress.sampledCount / SERVICE_ADVISOR_TARGET_CLIENTS) * 100)
                              );
                              const isAdvisorCompleted = advisorProgress.sampledCount >= SERVICE_ADVISOR_TARGET_CLIENTS;

                              return (
                                <div key={advisorProgress.advisorName} className="rounded-xl border border-slate-200 bg-white px-2.5 py-2">
                                  <div className="mb-1.5 flex items-center justify-between gap-3">
                                    <p className="truncate text-xs font-bold text-slate-800">{advisorProgress.advisorName}</p>
                                    <p className={cn(
                                      "text-[10px] font-black uppercase tracking-[0.15em]",
                                      isAdvisorCompleted ? "text-emerald-700" : "text-slate-600"
                                    )}>
                                      {Math.min(advisorProgress.sampledCount, SERVICE_ADVISOR_TARGET_CLIENTS)}/{SERVICE_ADVISOR_TARGET_CLIENTS}
                                    </p>
                                  </div>
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        isAdvisorCompleted ? "bg-emerald-500" : "bg-[#1d4f91]"
                                      )}
                                      style={{ width: `${completionPercent}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {isOrdersAudit && (
                      <div className="audit-sidebar-card rounded-[1.3rem] border border-slate-200 bg-white px-3.5 py-3.5 shadow-sm space-y-3">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Número de OR</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={session.orderNumber || ""}
                            onChange={(e) => setSession({ ...session, orderNumber: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                            placeholder="Ej. 154238"
                            className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3.5 font-bold text-sm focus:outline-none shadow-sm"
                          />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1d4f91]">Participantes de la OR</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                          {([
                            ["asesorServicio", "Asesor de servicio", OR_PARTICIPANTS.asesorServicio, true],
                            ["tecnico", "Técnico", OR_PARTICIPANTS.tecnico, false],
                            ["controller", "Controller", OR_PARTICIPANTS.controller, false],
                            ["lavador", "Lavador", OR_PARTICIPANTS.lavador, false],
                            ["repuestos", "Repuestos", OR_PARTICIPANTS.repuestos, false],
                          ] as const).map(([participantKey, label, options, required]) => (
                            <div key={participantKey} className="space-y-2">
                              <label className="px-1 text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</label>
                              <div className="relative">
                                <select
                                  value={(sessionParticipants[participantKey] ?? "") as string}
                                  onChange={(e) => setSession({
                                    ...session,
                                    participants: {
                                      ...sessionParticipants,
                                      [participantKey]: e.target.value,
                                    },
                                  })}
                                  className="w-full appearance-none rounded-2xl border border-gray-200 bg-slate-50 p-3.5 text-sm font-bold shadow-sm focus:outline-none"
                                >
                                  <option value="">{required ? `Seleccionar ${label.toLowerCase()}...` : `Sin ${label.toLowerCase()}...`}</option>
                                  {options.map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                  ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                          <div className="mb-2.5 flex items-center justify-between gap-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Avance por asesor</p>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-700">
                              {completedOrdersAdvisorsCount}/{sampledOrdersAdvisorProgress.length} en objetivo
                            </p>
                          </div>
                          <div className="space-y-2">
                            {sampledOrdersAdvisorProgress.map((advisorProgress) => {
                              const completionPercent = Math.min(
                                100,
                                Math.round((advisorProgress.sampledCount / ORDERS_TARGET_PER_ADVISOR) * 100)
                              );
                              const isAdvisorCompleted = advisorProgress.sampledCount >= ORDERS_TARGET_PER_ADVISOR;

                              return (
                                <div key={advisorProgress.advisorName} className="rounded-xl border border-slate-200 bg-white px-2.5 py-2">
                                  <div className="mb-1.5 flex items-center justify-between gap-3">
                                    <p className="truncate text-xs font-bold text-slate-800">{advisorProgress.advisorName}</p>
                                    <p className={cn(
                                      "text-[10px] font-black uppercase tracking-[0.15em]",
                                      isAdvisorCompleted ? "text-emerald-700" : "text-slate-600"
                                    )}>
                                      {Math.min(advisorProgress.sampledCount, ORDERS_TARGET_PER_ADVISOR)}/{ORDERS_TARGET_PER_ADVISOR}
                                    </p>
                                  </div>
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        isAdvisorCompleted ? "bg-emerald-500" : "bg-[#1d4f91]"
                                      )}
                                      style={{ width: `${completionPercent}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {isPreDeliveryAudit && (
                      <div className="rounded-[1.3rem] border border-slate-200 bg-white px-3.5 py-3.5 shadow-sm space-y-3">
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Sección activa</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setPreDeliverySection("general")}
                              className={cn(
                                "rounded-2xl border px-3 py-3 text-left transition",
                                preDeliverySection === "general"
                                  ? "border-slate-900 bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]"
                                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                              )}
                            >
                              <p className="text-[10px] font-black uppercase tracking-[0.16em]">General</p>
                              <p className={cn(
                                "mt-1 text-xs font-medium",
                                preDeliverySection === "general" ? "text-slate-300" : "text-slate-500"
                              )}>
                                {answeredGeneralCount}/{preDeliveryGeneralItems.length} respondidos
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreDeliverySection("legajos")}
                              className={cn(
                                "rounded-2xl border px-3 py-3 text-left transition",
                                preDeliverySection === "legajos"
                                  ? "border-slate-900 bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]"
                                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                              )}
                            >
                              <p className="text-[10px] font-black uppercase tracking-[0.16em]">Legajos</p>
                              <p className={cn(
                                "mt-1 text-xs font-medium",
                                preDeliverySection === "legajos" ? "text-slate-300" : "text-slate-500"
                              )}>
                                {answeredLegajoCount}/{preDeliveryLegajoItems.length} respondidos
                              </p>
                            </button>
                          </div>
                        </div>
                        {preDeliverySection === "general" ? null : (
                          <div className="space-y-3">
                            {currentLegajoCompleted && nextPendingLegajoIndex !== null && (
                              <button
                                type="button"
                                onClick={goToNextPendingLegajo}
                                className="w-full rounded-[1rem] border border-emerald-200 bg-emerald-50 px-3 py-3 text-left transition hover:border-emerald-300"
                              >
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Legajo completado</p>
                                <p className="mt-1 text-[11px] font-medium text-emerald-800">Pasar al siguiente pendiente: Legajo {nextPendingLegajoIndex + 1}</p>
                              </button>
                            )}
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Legajos auditados</p>
                            </div>
                            <div className="space-y-2.5">
                              {activePreDeliveryLegajoCard ? (
                                <div
                                  className="w-full rounded-[1.15rem] border border-slate-200 bg-white p-3 text-left"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setPreDeliveryActiveLegajoIndex((current) => Math.max(0, current - 1))}
                                      disabled={!canGoToPreviousLegajo}
                                      className={cn(
                                        "rounded-lg border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em]",
                                        canGoToPreviousLegajo ? "border-slate-300 bg-white text-slate-700" : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                                      )}
                                    >
                                      Anterior
                                    </button>
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                                      Legajo {activePreDeliveryLegajoCard.index + 1} de {preDeliveryLegajoCards.length}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => setPreDeliveryActiveLegajoIndex((current) => Math.min(preDeliveryLegajoCards.length - 1, current + 1))}
                                      disabled={!canGoToNextLegajo}
                                      className={cn(
                                        "rounded-lg border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em]",
                                        canGoToNextLegajo ? "border-slate-300 bg-white text-slate-700" : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                                      )}
                                    >
                                      Siguiente
                                    </button>
                                  </div>

                                  <div className="mt-2.5 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Legajo activo</p>
                                      <p className="mt-1.5 text-[13px] font-black leading-snug text-slate-900">{activePreDeliveryLegajoCard.trimmedName || "Sin nombre cargado"}</p>
                                    </div>
                                    <div className="space-y-1.5 text-right">
                                      <div className={cn(
                                        "rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em]",
                                        activePreDeliveryLegajoCard.status === "complete"
                                          ? "text-emerald-700"
                                          : activePreDeliveryLegajoCard.status === "in-progress"
                                            ? "text-amber-700"
                                            : "text-slate-600"
                                      )}>
                                        {activePreDeliveryLegajoCard.status === "complete" ? "Completo" : activePreDeliveryLegajoCard.status === "in-progress" ? "En progreso" : "Vacio"}
                                      </div>
                                      <p className="text-[10px] font-black text-slate-700">{activePreDeliveryLegajoCard.answeredCount}/{activePreDeliveryLegajoCard.totalCount}</p>
                                    </div>
                                  </div>

                                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        activePreDeliveryLegajoCard.status === "complete"
                                          ? "bg-emerald-500"
                                          : activePreDeliveryLegajoCard.status === "in-progress"
                                            ? "bg-amber-500"
                                            : "bg-slate-300"
                                      )}
                                      style={{ width: `${Math.max(activePreDeliveryLegajoCard.completionRatio * 100, activePreDeliveryLegajoCard.status === "empty" ? 12 : 0)}%` }}
                                    />
                                  </div>

                                  <div className="mt-2.5 space-y-1.5">
                                    <label className="block text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Nombre de persona o legajo</label>
                                    <input
                                      type="text"
                                      value={activePreDeliveryLegajoCard.name}
                                      onChange={(e) => {
                                        const nextAuditedFileNames = [...auditedFileNames];
                                        nextAuditedFileNames[activePreDeliveryLegajoCard.index] = e.target.value;
                                        setSession({
                                          ...session,
                                          auditedFileNames: nextAuditedFileNames,
                                        });
                                      }}
                                      placeholder={`Nombre del legajo o persona ${activePreDeliveryLegajoCard.index + 1}`}
                                      className="w-full rounded-[1rem] border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] font-bold text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="rounded-[1.2rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
                                  <p className="text-sm font-bold text-slate-600">No hay legajos para mostrar.</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                    <div className={cn("audit-workspace-main space-y-4 min-w-0 lg:pb-12", isQuickAuditMode ? "pb-40" : "pb-24")}>
                      <div className="audit-checklist-panel rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm lg:p-4">
                        <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Flujo</p>
                            <p className="mt-1 text-sm font-black text-slate-950">{draftSaveStateLabel}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsQuickAuditMode((current) => !current)}
                            className={cn(
                              "rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition",
                              isQuickAuditMode
                                ? "border-slate-900 bg-slate-950 text-white"
                                : "border-slate-200 bg-white text-slate-600"
                            )}
                          >
                            {isQuickAuditMode ? "Modo rápido" : "Modo completo"}
                          </button>
                        </div>

                        <div className="hidden lg:flex items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Checklist</p>
                            <h3 className="mt-1 text-base font-black text-slate-950">
                              {isOrdersAudit ? "OR Postventa" : isPreDeliveryAudit ? `Controles · ${preDeliverySection === "general" ? "General" : "Legajos"}` : "Controles"}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                              draftSaveState === "saving" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                            )}>{draftSaveState === "saving" ? "Guardando" : "Guardado"}</span>
                            <button
                              type="button"
                              onClick={() => setIsQuickAuditMode((current) => !current)}
                              className={cn(
                                "rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition",
                                isQuickAuditMode
                                  ? "border-slate-900 bg-slate-950 text-white"
                                  : "border-slate-200 bg-white text-slate-600"
                              )}
                            >
                              {isQuickAuditMode ? "Modo rápido" : "Modo completo"}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {isPreDeliveryAudit ? (
                            <>
                              {preDeliverySection === "general" && preDeliveryGeneralItems.length > 0 && (
                                <div className="space-y-4">
                                  {preDeliveryGeneralItems.map((auditItem, index) => (
                                    <AuditItemRow
                                      key={auditItem.id}
                                      rowId={`audit-item-${auditItem.id}`}
                                      question={auditItem.text}
                                      index={index}
                                      item={session.items?.find((item) => item.id === auditItem.id || item.question === auditItem.text)}
                                      required={false}
                                      block={auditItem.block}
                                      description={auditItem.description}
                                      responsibleRoles={auditItem.responsibleRoles}
                                      allowsNa={auditItem.allowsNa}
                                      priority={auditItem.priority}
                                      guidance={auditItem.guidance}
                                      requiresCommentOnFail={auditItem.requiresCommentOnFail}
                                      emphasized={focusedAuditItemId === auditItem.id || activeAuditItemId === auditItem.id}
                                      showStructuredQuestion={false}
                                      compactMeta
                                      quickMode={isQuickAuditMode}
                                      isActive={activeAuditItemId === auditItem.id}
                                      observationSuggestions={observationSuggestions}
                                      onActivate={() => focusAuditItem(auditItem)}
                                      onStatusToggle={(status) => toggleItemStatus(auditItem.text, status)}
                                      onCommentUpdate={(comment) => updateItemComment(auditItem.text, comment)}
                                      onPhotoUpdate={(photoUrl) => updateItemPhoto(auditItem.text, photoUrl)}
                                    />
                                  ))}
                                </div>
                              )}

                              {preDeliverySection === "legajos" && (
                                activePreDeliveryLegajoName ? (
                                  <div className="space-y-4">
                                    {activePreDeliveryLegajoItems.map((auditItem, index) => (
                                      <AuditItemRow
                                        key={auditItem.id}
                                        rowId={`audit-item-${auditItem.id}`}
                                        question={formatPreDeliveryLegajoQuestion(auditItem.text)}
                                        index={index}
                                        item={session.items?.find((item) => item.id === auditItem.id || item.question === auditItem.text)}
                                        required={false}
                                        block={auditItem.block}
                                        description={auditItem.description}
                                        responsibleRoles={auditItem.responsibleRoles}
                                        allowsNa={auditItem.allowsNa}
                                        priority={auditItem.priority}
                                        guidance={auditItem.guidance}
                                        requiresCommentOnFail={auditItem.requiresCommentOnFail}
                                        emphasized={focusedAuditItemId === auditItem.id || activeAuditItemId === auditItem.id}
                                        showStructuredQuestion={false}
                                        compactMeta
                                        quickMode={isQuickAuditMode}
                                        isActive={activeAuditItemId === auditItem.id}
                                        observationSuggestions={observationSuggestions}
                                        onActivate={() => focusAuditItem(auditItem)}
                                        onStatusToggle={(status) => toggleItemStatus(auditItem.text, status)}
                                        onCommentUpdate={(comment) => updateItemComment(auditItem.text, comment)}
                                        onPhotoUpdate={(photoUrl) => updateItemPhoto(auditItem.text, photoUrl)}
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <div className="rounded-[1.2rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
                                    <p className="text-sm font-bold text-slate-600">Ingresá un nombre en el legajo activo para ver sus controles.</p>
                                  </div>
                                )
                              )}
                            </>
                          ) : (
                            displayedAuditItems.map((auditItem) => (
                              <AuditItemRow
                                key={auditItem.id}
                                rowId={`audit-item-${auditItem.id}`}
                                question={auditItem.text}
                                index={displayedAuditItems.findIndex((item) => item.id === auditItem.id)}
                                item={session.items?.find((item) => item.id === auditItem.id || item.question === auditItem.text)}
                                required={false}
                                block={auditItem.block}
                                description={auditItem.description}
                                responsibleRoles={auditItem.responsibleRoles}
                                allowsNa={auditItem.allowsNa}
                                priority={auditItem.priority}
                                guidance={auditItem.guidance}
                                requiresCommentOnFail={auditItem.requiresCommentOnFail}
                                emphasized={focusedAuditItemId === auditItem.id || activeAuditItemId === auditItem.id}
                                showStructuredQuestion={isOrdersAudit}
                                quickMode={isQuickAuditMode}
                                isActive={activeAuditItemId === auditItem.id}
                                observationSuggestions={observationSuggestions}
                                onActivate={() => focusAuditItem(auditItem)}
                                onStatusToggle={(status) => toggleItemStatus(auditItem.text, status)}
                                onCommentUpdate={(comment) => updateItemComment(auditItem.text, comment)}
                                onPhotoUpdate={(photoUrl) => updateItemPhoto(auditItem.text, photoUrl)}
                              />
                            ))
                          )}
                        </div>
                      </div>

                      <div className="audit-closure-grid grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                        <div className="audit-notes-panel space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Observaciones</label>
                          <textarea
                            placeholder="Observaciones"
                            value={session.notes || ""}
                            onChange={(e) => setSession({ ...session, notes: e.target.value })}
                            className={cn(
                              "audit-notes-textarea w-full p-6 border rounded-3xl font-medium text-sm focus:outline-none shadow-sm min-h-[160px]",
                              selectedRole === "Ordenes"
                                ? "bg-white border-slate-200 text-slate-700"
                                : "bg-white border-gray-200"
                            )}
                          />

                          {isAuditChecklistCompleted && (
                          <div className="audit-submit-panel rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm space-y-4 lg:hidden">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cierre</p>
                              <p className="mt-2 text-sm font-black text-slate-900">Enviar</p>
                              {failItemsWithoutCommentCount > 0 && (
                                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Faltan {failItemsWithoutCommentCount} observaciones obligatorias en desvíos.</p>
                              )}
                            </div>

                            {isOrdersAudit || isServiceAdvisorAudit || isTechnicianAudit ? (
                              <div className="grid grid-cols-1 gap-2.5">
                                <button
                                  onClick={() => handleAuditSubmit("continue")}
                                  disabled={isSubmitDisabled}
                                  className={cn(
                                    "w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg",
                                    !isSubmitDisabled
                                      ? "bg-white text-slate-900 border border-slate-200 shadow-slate-100 hover:bg-slate-50"
                                      : "bg-gray-200 text-gray-500 cursor-not-allowed shadow-none"
                                  )}
                                >
                                  {isSendingToSheet ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
                                      Guardando...
                                    </>
                                  ) : (
                                    <>
                                      <Save className="w-4 h-4" />
                                      {isServiceAdvisorAudit ? "Guardar y seguir con otro cliente" : isTechnicianAudit ? "Guardar y seguir con otro técnico" : "Guardar y seguir con otra OR"}
                                    </>
                                  )}
                                </button>

                                <button
                                  onClick={() => handleAuditSubmit("finish")}
                                  disabled={isSubmitDisabled}
                                  className={cn(
                                    "w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg",
                                    !isSubmitDisabled
                                      ? "bg-slate-950 text-white shadow-slate-300 hover:bg-[#0c2340]"
                                      : "bg-gray-200 text-gray-500 cursor-not-allowed shadow-none"
                                  )}
                                >
                                  {isSendingToSheet ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                      Guardando...
                                    </>
                                  ) : (
                                    <>
                                      <Save className="w-4 h-4" />
                                      Guardar y finalizar
                                    </>
                                  )}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleAuditSubmit("finish")}
                                disabled={isSubmitDisabled}
                                className={cn(
                                  "w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg",
                                  !isSubmitDisabled
                                    ? "bg-slate-950 text-white shadow-slate-300 hover:bg-[#0c2340]"
                                    : "bg-gray-200 text-gray-500 cursor-not-allowed shadow-none"
                                )}
                              >
                                {isSendingToSheet ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    Enviando al Sheet...
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-4 h-4" />
                                    Enviar
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                          )}
                        </div>

                        <div className="audit-submit-panel hidden rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm space-y-4 lg:sticky lg:top-28 lg:block">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cierre</p>
                            <p className="mt-2 text-sm font-black text-slate-900">Enviar</p>
                            {failItemsWithoutCommentCount > 0 && (
                              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Faltan {failItemsWithoutCommentCount} observaciones obligatorias en desvíos.</p>
                            )}
                          </div>

                          {isOrdersAudit || isServiceAdvisorAudit || isTechnicianAudit ? (
                            <div className="grid grid-cols-1 gap-2.5">
                              <button
                                onClick={() => handleAuditSubmit("continue")}
                                disabled={isSubmitDisabled}
                                className={cn(
                                  "w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg",
                                  !isSubmitDisabled
                                    ? "bg-white text-slate-900 border border-slate-200 shadow-slate-100 hover:bg-slate-50"
                                    : "bg-gray-200 text-gray-500 cursor-not-allowed shadow-none"
                                )}
                              >
                                {isSendingToSheet ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
                                    Guardando...
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-4 h-4" />
                                    {isServiceAdvisorAudit ? "Guardar y seguir con otro cliente" : isTechnicianAudit ? "Guardar y seguir con otro técnico" : "Guardar y seguir con otra OR"}
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleAuditSubmit("finish")}
                                disabled={isSubmitDisabled}
                                className={cn(
                                  "w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg",
                                  !isSubmitDisabled
                                    ? "bg-slate-950 text-white shadow-slate-300 hover:bg-[#0c2340]"
                                    : "bg-gray-200 text-gray-500 cursor-not-allowed shadow-none"
                                )}
                              >
                                {isSendingToSheet ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    Guardando...
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-4 h-4" />
                                    Guardar y finalizar
                                  </>
                                )}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAuditSubmit("finish")}
                              disabled={isSubmitDisabled}
                              className={cn(
                                "w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg",
                                !isSubmitDisabled
                                  ? "bg-green-600 text-white shadow-green-100 hover:bg-green-700"
                                  : "bg-gray-200 text-gray-500 cursor-not-allowed shadow-none"
                              )}
                            >
                              {isSendingToSheet ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                  Enviando al Sheet...
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4" />
                                  Enviar
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {isQuickAuditMode && activeAuditItem && (
                      <div className="audit-quickbar fixed inset-x-0 bottom-[5.75rem] z-40 border-t border-slate-200 bg-white/96 p-3 backdrop-blur-xl lg:hidden">
                        <div className="mx-auto max-w-6xl rounded-[1.4rem] border border-slate-200 bg-white px-3 py-3 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Punto activo {activeAuditItemIndex + 1}/{visibleAuditItems.length}</p>
                              <p className="mt-1 line-clamp-2 text-sm font-black text-slate-950">{isPreDeliveryAudit && preDeliverySection === "legajos" ? formatPreDeliveryLegajoQuestion(activeAuditItem.text) : activeAuditItem.text}</p>
                            </div>
                            <span className={cn(
                              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                              activeAuditSessionItem?.status === "pass" ? "bg-emerald-50 text-emerald-700" :
                              activeAuditSessionItem?.status === "fail" ? "bg-red-50 text-red-700" :
                              activeAuditSessionItem?.status === "na" ? "bg-slate-100 text-slate-600" :
                              "bg-amber-50 text-amber-700"
                            )}>
                              {getAuditItemStatusLabel(activeAuditSessionItem?.status)}
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => toggleItemStatus(activeAuditItem.text, "pass")}
                              className="rounded-[1rem] bg-emerald-500 px-3 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white"
                            >
                              Si
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleItemStatus(activeAuditItem.text, "fail")}
                              className="rounded-[1rem] bg-red-500 px-3 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white"
                            >
                              No
                            </button>
                            {activeAuditItem.allowsNa !== false ? (
                              <button
                                type="button"
                                onClick={() => toggleItemStatus(activeAuditItem.text, "na")}
                                className="rounded-[1rem] bg-slate-900 px-3 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white"
                              >
                                N/A
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="cursor-not-allowed rounded-[1rem] bg-slate-200 px-3 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500"
                              >
                                N/A
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
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
                  handleLoadStructureFromCloud={handleLoadStructureFromCloud}
                  handleSaveStructureToCloud={handleSaveStructureToCloud}
                  handleResetStructure={handleResetStructure}
                  auditCategories={auditCategories}
                  selectedStructureCategory={selectedStructureCategory}
                  selectedStructureCategoryId={selectedStructureCategoryId}
                  setSelectedStructureCategoryId={setSelectedStructureCategoryId}
                  updateCategory={updateCategory}
                  handleDeleteCategory={handleDeleteCategory}
                  newCategoryName={newCategoryName}
                  setNewCategoryName={setNewCategoryName}
                  newCategoryDescription={newCategoryDescription}
                  setNewCategoryDescription={setNewCategoryDescription}
                  newCategoryStaff={newCategoryStaff}
                  setNewCategoryStaff={setNewCategoryStaff}
                  handleAddCategory={handleAddCategory}
                  newItemText={newItemText}
                  setNewItemText={setNewItemText}
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


      <AppModal 
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setPendingOrdersSubmitMode("finish");
        }}
        onConfirm={() => submitAudit(pendingOrdersSubmitMode)}
        title={pendingOrdersSubmitMode === "continue"
          ? (isServiceAdvisorAudit
            ? "¿Guardar y continuar con otro cliente?"
            : isTechnicianAudit
              ? "¿Guardar y continuar con otro técnico?"
              : "¿Guardar y continuar con otra OR?")
          : "¿Guardar y finalizar auditoría?"}
        message={pendingOrdersSubmitMode === "continue"
          ? `Quedan ${optionalPendingCount} ítems opcionales sin responder. ¿Deseás guardar esta evaluación y continuar igualmente?`
          : `Quedan ${optionalPendingCount} ítems opcionales sin responder. ¿Deseás finalizar igualmente?`}
      />

      <AnimatePresence>
        {showBatchReportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBatchReportModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="panel-premium relative flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2.3rem]"
            >
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5 md:px-8">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Reporte</p>
                  <h3 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">Puntajes detallados</h3>
                </div>
                <button
                  onClick={() => setShowBatchReportModal(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition-all hover:border-slate-300 hover:text-slate-900"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 md:px-8">
                {completedAuditReports.map((report) => {
                  const sectionScores = getSectionScores(report.templateItems, report.session);

                  return (
                    <div key={`${report.role}-${report.session.id}`} className="rounded-[1.9rem] border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{report.session.location}</p>
                          <h4 className="mt-2 text-xl font-black text-slate-950">{report.role}</h4>
                          <p className="mt-1 text-sm font-bold text-slate-500">{report.session.staffName || report.auditorName} · {report.session.date}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-center text-emerald-700">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em]">Score</p>
                            <p className="mt-1 text-xl font-black">{report.session.totalScore}%</p>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={async () => {
                              const { generateAuditPdfReport } = await import("./services/audit-report-pdf");
                              await generateAuditPdfReport({
                                appTitle,
                                session: report.session,
                                auditorName: report.auditorName,
                                templateItems: report.templateItems,
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
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-black text-gray-900 leading-tight">Detalles de Auditoría</h3>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
                    {selectedAudit.role || selectedAudit.items[0]?.category} - {selectedAudit.date}
                  </p>
                </div>
                <div className={cn(
                  "px-4 py-2 rounded-xl font-black text-lg",
                  selectedAudit.totalScore >= 90 ? "bg-green-50 text-green-600" : 
                  selectedAudit.totalScore >= 70 ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-600"
                )}>
                  {selectedAudit.totalScore}%
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Personal</p>
                    <p className="text-sm font-bold text-gray-700">{selectedAudit.staffName || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ubicación</p>
                    <p className="text-sm font-bold text-gray-700">{selectedAudit.location}</p>
                  </div>
                  {selectedAudit.orderNumber && (
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Número de OR</p>
                      <p className="text-sm font-bold text-blue-600">{selectedAudit.orderNumber}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Resultados por Ítem</p>
                  {selectedAudit.items.map((item, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-2xl space-y-2">
                      <div className="flex justify-between items-start gap-4">
                        <p className="text-xs font-bold text-gray-700 leading-snug">{item.question}</p>
                        <span className={cn(
                          "text-[10px] font-black uppercase px-2 py-1 rounded-md shrink-0",
                          item.status === "pass" ? "bg-green-100 text-green-600" : 
                          item.status === "fail" ? "bg-red-100 text-red-600" : "bg-gray-200 text-gray-500"
                        )}>
                          {item.status === "pass" ? "Cumple" : item.status === "fail" ? "No Cumple" : "N/A"}
                        </span>
                      </div>
                      {item.comment && (
                        <p className="text-[10px] text-gray-500 italic">"{item.comment}"</p>
                      )}
                    </div>
                  ))}
                </div>

                {selectedAudit.notes && (
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Notas Generales</p>
                    <p className="text-xs text-blue-700 leading-relaxed">{selectedAudit.notes}</p>
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-gray-100">
                <button 
                  onClick={() => setSelectedAudit(null)}
                  className="w-full py-4 rounded-2xl font-black text-white bg-gray-900 hover:bg-black transition-all"
                >
                  Cerrar
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
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl p-8 space-y-6"
            >
              <div>
                <h3 className="text-xl font-black text-gray-900">Eliminar Auditoría</h3>
                <p className="text-sm font-bold text-gray-600 mt-2">¿Estás seguro de que deseas eliminar esta auditoría?</p>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                <p className="text-xs font-black text-red-700 uppercase">Auditoría a eliminar:</p>
                <p className="text-sm font-bold text-red-900 break-words">{deleteConfirmModal.auditName}</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-amber-700">⚠️ Esta acción eliminará la auditoría de forma permanente de todos los sistemas (borradores y guardadas).</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmModal({ show: false, auditId: "", auditName: "" })}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 hover:bg-gray-100 font-black text-sm text-gray-900 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteAudit(deleteConfirmModal.auditId)}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 font-black text-sm text-white transition-all"
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
