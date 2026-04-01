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
  ClipboardCheck, 
  MapPin, 
  User, 
  ChevronRight, 
  XCircle, 
  Save,
  History,
  Plus,
  ArrowLeft,
  Check,
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
  AlertCircle,
  Clock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, createClientId } from "./lib/utils";
import { buildAuditSyncPayload, sendAuditToWebhook } from "./services/audit-sync";
import { 
  LOCATIONS, 
  AUDITORS,
  OR_PARTICIPANTS,
  OR_ROLE_LABELS
} from "./constants";
import { AuditSession, AuditTemplateItem, AuditUserProfile, Location, OrResponsibleRole, Role } from "./types";
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
import { AuditItemRow } from "./components/audit/AuditItemRow";
import { LoginView } from "./components/views/LoginView";
import { Sidebar } from "./components/layout/Sidebar";
import { Topbar } from "./components/layout/Topbar";
import { Button } from "./components/ui/Button";
import { AppModal } from "./components/ui/Modal";
import { useAuditDrafts } from "./hooks/useAuditDrafts";
import { useHashNavigation } from "./hooks/useHashNavigation";
import { useAuditStructure } from "./hooks/useAuditStructure";
import { useAuditSync } from "./hooks/useAuditSync";

const DashboardView = React.lazy(() => import("./components/views/DashboardView").then((module) => ({ default: module.DashboardView })));
const HistoryView = React.lazy(() => import("./components/history/HistoryView").then((module) => ({ default: module.HistoryView })));
const StructurePanel = React.lazy(() => import("./components/reports/StructurePanel").then((module) => ({ default: module.StructurePanel })));

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
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState<"dashboard" | "home" | "setup" | "audit" | "history" | "structure" | "integrations">("dashboard");
  const [isSyncing, setIsSyncing] = useState(false);
  const [session, setSession] = useState<Partial<AuditSession>>({
    date: new Date().toISOString().split("T")[0],
    items: []
  });
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAudit, setSelectedAudit] = useState<AuditSession | null>(null);
  const [historyPanel, setHistoryPanel] = useState<"records" | "exports">("records");
  const [webhookUrl, setWebhookUrl] = useState<string>(localStorage.getItem("webhookUrl") || envWebhookUrl);
  const [sheetCsvUrl, setSheetCsvUrl] = useState<string>(localStorage.getItem("sheetCsvUrl") || envSheetCsvUrl);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSendingToSheet, setIsSendingToSheet] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [focusedAuditItemId, setFocusedAuditItemId] = useState<string | null>(null);
  const [activeAuditItemId, setActiveAuditItemId] = useState<string | null>(null);
  const [completedAuditReports, setCompletedAuditReports] = useState<CompletedAuditReport[]>([]);
  const [showBatchReportModal, setShowBatchReportModal] = useState(false);
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
  const currentOrRoleScores = isOrdersAudit ? calculateRoleScores(sessionOrderItems) : [];
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
  const ORDERS_TARGET_ADVISORS = Math.max(OR_PARTICIPANTS.asesorServicio.length, 1);
  const currentAuditBatchName = session.auditBatchName?.trim() || "";
  const sampledOrdersHistory = Array.from(
    [...history, ...completedAuditReports.map((report) => report.session)]
      .filter((auditSession) => {
        if (!currentAuditBatchName) {
          return false;
        }

        const isOrdersSession = auditSession.entityType === "or"
          || auditSession.role === "Ordenes"
          || Boolean(auditSession.orderNumber?.trim());
        if (!isOrdersSession) {
          return false;
        }

        return auditSession.auditBatchName?.trim() === currentAuditBatchName;
      })
      .reduce((acc, auditSession) => {
        const fallbackId = `${auditSession.role || "sin-rol"}-${auditSession.date || "sin-fecha"}-${auditSession.orderNumber || "sin-or"}-${auditSession.participants?.asesorServicio || auditSession.staffName || "sin-asesor"}`;
        const sessionId = auditSession.id || fallbackId;
        if (!acc.has(sessionId)) {
          acc.set(sessionId, auditSession);
        }
        return acc;
      }, new Map<string, AuditSession>())
      .values()
  );
  const sampledOrdersByAdvisor = sampledOrdersHistory.reduce((acc, auditSession) => {
    const advisorName = auditSession.participants?.asesorServicio?.trim() || auditSession.staffName?.trim();
    if (!advisorName) {
      return acc;
    }

    acc.set(advisorName, (acc.get(advisorName) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());
  const configuredAdvisorNames = OR_PARTICIPANTS.asesorServicio;
  const sampledOrdersAdvisorProgress = [
    ...configuredAdvisorNames.map((advisorName) => ({
      advisorName,
      sampledCount: sampledOrdersByAdvisor.get(advisorName) ?? 0,
    })),
    ...Array.from(sampledOrdersByAdvisor.entries())
      .filter(([advisorName]) => !configuredAdvisorNames.includes(advisorName as typeof configuredAdvisorNames[number]))
      .map(([advisorName, sampledCount]) => ({ advisorName, sampledCount })),
  ].sort((left, right) => {
    const completionDelta = (right.sampledCount >= ORDERS_TARGET_PER_ADVISOR ? 1 : 0) - (left.sampledCount >= ORDERS_TARGET_PER_ADVISOR ? 1 : 0);
    if (completionDelta !== 0) {
      return completionDelta;
    }

    return right.sampledCount - left.sampledCount;
  });
  const completedOrdersAdvisorsCount = sampledOrdersAdvisorProgress.filter(
    (advisorProgress) => advisorProgress.sampledCount >= ORDERS_TARGET_PER_ADVISOR
  ).length;
  const sampledOrdersProgress = Math.round(
    (Array.from(sampledOrdersByAdvisor.values())
      .sort((left, right) => right - left)
      .slice(0, ORDERS_TARGET_ADVISORS)
      .reduce((total, advisorCount) => total + Math.min(advisorCount, ORDERS_TARGET_PER_ADVISOR), 0)
      / (ORDERS_TARGET_PER_ADVISOR * ORDERS_TARGET_ADVISORS || 1))
      * 100
  );
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
  const sidebarItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    ...(canRunAudits ? [{ id: "home", label: "Nueva Auditoría", icon: Plus }] : []),
    { id: "history", label: "Historial", icon: History },
    ...(canAccessStructure ? [{ id: "structure", label: "Estructura", icon: Settings }] : []),
    ...(canAccessIntegrations ? [{ id: "integrations", label: "Integraciones", icon: ShieldCheck }] : []),
  ];
  const filteredHistory = history.filter((item) =>
    item.staffName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.items[0]?.category.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const recentAudits = history.slice(0, 3);
  const selectedHistoryAudit = view === "history" ? selectedAudit : null;
  const historyAverageScore = Math.round(filteredHistory.reduce((acc, item) => acc + item.totalScore, 0) / (filteredHistory.length || 1));
  const nonCompliantAudits = filteredHistory.filter((item) => item.totalScore < 90).length;
  const latestHistoryItem = filteredHistory[0] ?? null;

  const resumeDraftSession = React.useCallback((draft: {
    id: string;
    date: string;
    auditBatchName?: string;
    auditorId?: string;
    location?: Location;
    staffName?: string;
    role?: Role;
    items: AuditSession["items"];
    orderNumber?: string;
    auditedFileNames?: string[];
    notes?: string;
    participants?: AuditSession["participants"];
  }) => {
    setSession({
      id: draft.id,
      date: draft.date,
      auditBatchName: draft.auditBatchName,
      auditorId: draft.auditorId,
      location: draft.location,
      orderNumber: draft.orderNumber,
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
  }, [formatAuditMonthLabel, history, sortedDraftAudits]);

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
  }, []);

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

  const startNewAudit = () => {
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
      items: []
    });
    setSelectedRole(null);
    setSelectedStaff("");
    setView("setup");
  };

  const handleSetupSubmit = () => {
    if (!canRunAudits) {
      alert("El perfil Consulta no puede iniciar auditorías.");
      return;
    }

    if (session.auditorId && session.location) {
      setSession((current) => ensureSessionMetadata(current));
      setView("audit");
    }
  };

  const calculateCurrentScore = () => {
    if (!session.items || session.items.length === 0) return 0;
    const validItems = session.items.filter(i => i.status !== "na");
    if (validItems.length === 0) return 0;
    const passItems = validItems.filter(i => i.status === "pass");
    return Math.round((passItems.length / validItems.length) * 100);
  };

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
        : isPreDeliveryAudit
          ? undefined
          : selectedStaff,
      role: selectedRole!,
      orderNumber: selectedRole === "Ordenes" ? session.orderNumber?.trim() || undefined : undefined,
      auditedFileNames: isPreDeliveryAudit ? auditedFileNames.map((name) => name.trim()) : undefined,
      totalScore: complianceMetrics.compliance,
      items: finalItems,
      participants: session.participants,
      roleScores,
      entityType: selectedRole === "Ordenes" ? "or" : "general",
    };
    const shouldKeepOrdersAdvisor = completeSession.role === "Ordenes" && submitMode === "continue";
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
      setSelectedStaff("");
      setView("audit");
      setSession({
        id: createClientId(),
        date: completeSession.date,
        auditBatchName: completeSession.auditBatchName,
        auditorId: completeSession.auditorId,
        location: completeSession.location,
        auditedFileNames: createEmptyAuditedFileNames(),
        participants: isOrdersAudit ? nextOrdersParticipants : undefined,
        items: [],
      });

      if (!(completeSession.role === "Ordenes" && submitMode === "continue")) {
        setSelectedRole(null);
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
      setSelectedStaff("");
      setView("audit");
      setSession({
        id: createClientId(),
        date: completeSession.date,
        auditBatchName: completeSession.auditBatchName,
        auditorId: completeSession.auditorId,
        location: completeSession.location,
        auditedFileNames: createEmptyAuditedFileNames(),
        participants: isOrdersAudit ? nextOrdersParticipants : undefined,
        items: [],
      });

      if (!(completeSession.role === "Ordenes" && submitMode === "continue")) {
        setSelectedRole(null);
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
            alert("La fuente CSV respondió, pero tiene un formato inválido o incompleto.");
            setIsSyncing(false);
            return;
          }

          alert(`CSV externo verificado. Se leyeron ${rows.length} registros publicados.`);
          setIsSyncing(false);
        }
      });
    } catch (error) {
      console.error("Sync failed:", error);
      alert("No se pudo leer la fuente CSV publicada. Revisá la URL y el acceso público.");
      setIsSyncing(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSessionStarted) {
    return (
      <LoginView
        appTitle={appTitle}
        isLoggingIn={isLoggingIn}
        firebaseEnabled={isFirebaseEnabled}
        user={user}
        onSelectProfile={handleSelectProfile}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <div className="app-shell min-h-screen lg:flex">
      <Sidebar
        appTitle={appTitle}
        show={view === "dashboard" || view === "history" || view === "structure" || view === "integrations"}
        view={view}
        isMobileOpen={isMobileNavOpen}
        items={sidebarItems}
        user={user}
        onNavigate={(id) => {
          if (id === "home") {
            startNewAudit();
            return;
          }

          setView(id as typeof view);
        }}
        onMobileClose={() => setIsMobileNavOpen(false)}
        onLogout={handleLogout}
      />

        <div ref={contentContainerRef} className="flex-1 flex flex-col h-screen overflow-y-auto">
        <Topbar
          appTitle={appTitle}
          view={view}
          user={user}
          userProfile={userProfile}
          onUserProfileChange={setUserProfile}
            authenticationEnabled={isFirebaseEnabled}
          showMenuButton={view === "dashboard" || view === "history" || view === "structure" || view === "integrations"}
          showBackButton={view !== "dashboard"}
          onOpenMenu={() => setIsMobileNavOpen(true)}
          onBack={handleTopbarBack}
          onLogin={handleLogin}
        />

        <main className={cn(
          "p-4 md:p-8 transition-all duration-500",
          view === "dashboard" ? "max-w-7xl mx-auto w-full" : 
          view === "setup" ? "max-w-5xl mx-auto w-full pb-32" :
          view === "audit" ? "max-w-7xl mx-auto w-full pb-28 pt-2 md:pt-4" :
          view === "structure" ? "max-w-6xl mx-auto w-full pb-12" :
          view === "integrations" ? "max-w-6xl mx-auto w-full pb-12" :
          view === "home" ? "max-w-md mx-auto w-full pb-32" :
          "max-w-md mx-auto w-full lg:max-w-4xl lg:mx-0"
        )}>
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
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >


              <div className="bg-gradient-to-br from-teal-700 via-teal-600 to-amber-500 rounded-[2.5rem] p-8 shadow-xl shadow-teal-100 text-center space-y-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                  <div className="absolute -top-10 -left-10 w-40 h-40 bg-white rounded-full blur-3xl" />
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white rounded-full blur-3xl" />
                </div>
                
                <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto ring-1 ring-white/30">
                  <ClipboardCheck className="w-10 h-10 text-white" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white tracking-tight">Cabina de auditoría</h2>
                  <p className="text-teal-50 text-sm font-medium">Preparada para uso móvil, captura operativa y sincronización con tus fuentes externas.</p>
                </div>

                <div className="space-y-3 pt-2">
                  <button 
                    onClick={startNewAudit}
                    disabled={isLoggingIn}
                    className={cn(
                      "w-full bg-white text-blue-700 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-blue-50 transition-all active:scale-95 shadow-lg",
                      isLoggingIn && "opacity-70 cursor-not-allowed"
                    )}
                  >
                    <Plus className="w-5 h-5" />
                    Iniciar Ahora
                  </button>
                  
                  <button 
                    onClick={syncData}
                    disabled={isSyncing}
                    className="w-full bg-black/15 text-white border border-white/15 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black/25 transition-all active:scale-95 text-[10px] uppercase tracking-widest"
                  >
                    <div className={cn("w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin", !isSyncing && "hidden")} />
                    {isSyncing ? "Sincronizando..." : "Sincronizar Datos"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-[2rem] border border-white/70 bg-white/80 backdrop-blur p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", isSheetSyncConfigured ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                      <ClipboardCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Apps Script</p>
                      <p className="text-sm font-black text-slate-900">{isSheetSyncConfigured ? "Activo" : "Pendiente"}</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">{isSheetSyncConfigured ? "Las auditorías pueden enviarse al endpoint configurado." : "Falta definir la URL de recepción para enviar auditorías."}</p>
                </div>
                <div className="rounded-[2rem] border border-white/70 bg-white/80 backdrop-blur p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", isHistorySyncConfigured ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Historial externo</p>
                      <p className="text-sm font-black text-slate-900">{historySyncModeLabel}</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">{hasWebhookUrl ? "El historial puede importarse completo desde Apps Script y Google Sheets." : hasSheetCsvUrl ? "Hay una fuente CSV de respaldo configurada para validación externa." : "Definí un Apps Script o una URL CSV publicada para refrescar reportes."}</p>
                </div>
                <div className="rounded-[2rem] border border-white/70 bg-white/80 backdrop-blur p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", user ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Acceso</p>
                      <p className="text-sm font-black text-slate-900">{isFirebaseEnabled ? (user ? "Autenticado" : "Invitado") : "Sheets only"}</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">{isUsingExternalHistory ? "Se está usando historial importado desde Google Sheets." : user && isFirebaseEnabled ? "Hay acceso a historial y persistencia en Firestore." : localAuditHistory.length > 0 ? "Hay historial guardado en este dispositivo." : isFirebaseEnabled ? "Los datos nuevos se guardarán en este dispositivo hasta iniciar sesión." : "La operación está centrada en Apps Script, Google Sheets y almacenamiento local."}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-bold text-gray-900">Historial Reciente</h3>
                  <button 
                    onClick={() => setView("history")}
                    className="text-sm text-gray-500 font-medium"
                  >
                    Ver todo
                  </button>
                </div>
                
                {!user && !isUsingExternalHistory && localAuditHistory.length === 0 ? (
                  <div className="bg-white rounded-2xl p-6 border border-dashed border-gray-300 text-center">
                    <p className="text-gray-400 text-sm italic">Todavía no hay auditorías guardadas.</p>
                  </div>
                ) : history.length === 0 ? (
                  <div className="bg-white rounded-2xl p-6 border border-dashed border-gray-300 text-center">
                    <p className="text-gray-400 text-sm">No hay auditorías registradas aún.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentAudits.map((item) => (
                      <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg",
                            item.totalScore >= 90 ? "bg-green-50 text-green-600" : 
                            item.totalScore >= 70 ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-600"
                          )}>
                            {item.totalScore}%
                          </div>
                          <div>
                            <p className="font-bold text-sm">{item.location} - {item.date}</p>
                            <p className="text-xs text-gray-500">{item.items.length} ítems auditados</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === "setup" && (
            <motion.div 
              key="setup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="mx-auto max-w-4xl">
                <div className="panel-premium rounded-[2.3rem] p-5 md:p-7">
                  <div className="flex items-center justify-between gap-3 pb-5">
                    <h2 className="text-2xl font-black tracking-[-0.03em] text-slate-950 md:text-3xl">Configuración de auditoría</h2>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{session.date}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Auditor</p>
                      <div className="grid grid-cols-1 gap-3">
                        {AUDITORS.map((auditor) => (
                          <button
                            key={auditor.id}
                            onClick={() => setSession({ ...session, auditorId: auditor.id })}
                            className={cn(
                              "flex items-center justify-between rounded-[1.5rem] border px-4 py-4 text-left transition-all",
                              session.auditorId === auditor.id
                                ? "border-slate-950 bg-slate-950 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-xl",
                                session.auditorId === auditor.id ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"
                              )}>
                                <User className="w-4.5 h-4.5" />
                              </div>
                              <p className="text-sm font-black">{auditor.name}</p>
                            </div>
                            {session.auditorId === auditor.id && <Check className="w-5 h-5" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Sucursal</p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        {LOCATIONS.map((loc) => (
                          <button
                            key={loc}
                            onClick={() => setSession({ ...session, location: loc as Location })}
                            className={cn(
                              "flex items-center justify-between rounded-[1.5rem] border px-4 py-4 text-left transition-all",
                              session.location === loc
                                ? "border-slate-950 bg-slate-950 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-xl",
                                session.location === loc ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"
                              )}>
                                <MapPin className="w-4.5 h-4.5" />
                              </div>
                              <p className="text-sm font-black">{loc}</p>
                            </div>
                            {session.location === loc && <Check className="w-5 h-5" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    {session.location && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left sm:max-w-[60%]">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Nombre de auditoría</p>
                        <p className="mt-1 text-sm font-black text-slate-900">{auditBatchDisplayName}</p>
                      </div>
                    )}
                    <button
                      onClick={() => setView("dashboard")}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-700 transition-all hover:border-slate-300"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Cancelar
                    </button>

                    <button 
                      onClick={handleSetupSubmit}
                      disabled={!session.auditorId || !session.location}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Continuar
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
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

                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-2.5 xl:grid-cols-6 xl:gap-3">
                    {auditCategories.map((category) => {
                      const completedCategoryReport = completedAuditReports.find((report) => report.role === category.name);
                      const isOrdersCategory = category.name === "Ordenes";
                      const categoryProgress = isOrdersCategory
                        ? sampledOrdersProgress
                        : completedCategoryReport?.session.totalScore;
                      const isCategoryTracked = typeof categoryProgress === "number";

                      return (
                      <button
                        key={category.id}
                        onClick={() => {
                          setSelectedRole(category.name);
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
                          {!["Asesor", "Técnico", "Jefe", "Lavadero", "Garantía", "Repuestos", "Pre Entrega", "Ordenes"].some(k => category.name.includes(k)) && (
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

                  {completedAuditReports.length > 0 && (
                    <div className="flex justify-end">
                      <Button variant="secondary" size="lg" onClick={() => setShowBatchReportModal(true)} className="border-slate-200 bg-white text-slate-900 hover:bg-slate-50">
                        <FileText className="h-4 w-4" />
                        Generar reporte
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                <div className="lg:hidden rounded-[1.6rem] border border-slate-200 bg-[linear-gradient(135deg,#081222_0%,#12345d_100%)] p-3.5 text-white shadow-[0_14px_34px_rgba(12,35,64,0.18)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Auditoría en campo</p>
                      <h2 className="mt-1.5 text-lg font-black tracking-[-0.03em] text-white">{selectedRole}</h2>
                      <p className="mt-1.5 text-sm font-medium text-slate-300">
                        {isOrdersAudit
                          ? `OR ${session.orderNumber || "sin número"} · ${sessionParticipants.asesorServicio || "Sin asesor"}`
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
                    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">OR {currentOrCompliance.compliance}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
                  <div className="space-y-3 lg:sticky lg:top-24 h-fit lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-2">
                    <div className={cn(
                      "hidden space-y-3 rounded-[1.5rem] lg:block",
                      selectedRole === "Ordenes" ? "bg-[#EEF3F9]/95 backdrop-blur-xl" : "bg-[#F9F9F9] border border-slate-200"
                    )}>
                      <div className={cn(
                        "flex items-center justify-between rounded-[1.6rem] border px-4 py-3.5 shadow-[0_18px_44px_rgba(12,35,64,0.22)]",
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
                              {selectedRole === "Ordenes" ? `OR ${session.orderNumber || "sin número"}` : (auditBatchDisplayName || "Auditoría en curso")}
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
                          )}>{selectedRole === "Ordenes" ? "Cumplimiento OR" : "Progreso"}</div>
                          <div className={cn(
                            "text-[10px] font-black uppercase tracking-tighter mt-1",
                            selectedRole === "Ordenes" ? "text-cyan-200" : "text-emerald-600"
                          )}>{sessionItems.length}/{displayedAuditItems.length}</div>
                        </div>
                      </div>

                      <div className="space-y-3 rounded-[1.2rem] border border-slate-200 bg-white p-3.5 shadow-sm">
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

                      {isOrdersAudit && (
                        <div className="grid grid-cols-1 gap-2">
                          {(["asesor", "tecnico", "controller", "lavador", "repuestos"] as OrResponsibleRole[]).map((role) => {
                            const roleScore = currentOrRoleScores.find((item) => item.role === role);
                            return (
                              <div key={role} className="rounded-[1rem] border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{OR_ROLE_LABELS[role]}</p>
                                  <p className="text-sm font-black text-slate-950">{roleScore?.compliance ?? 0}%</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                  </div>

                    {!isOrdersAudit && !isPreDeliveryAudit && selectedAuditStaffOptions.length > 0 && (
                      <div className="space-y-2 rounded-[1.3rem] border border-slate-200 bg-white p-3.5 shadow-sm">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Personal Auditado</label>
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
                      </div>
                    )}

                    {isOrdersAudit && (
                      <div className="rounded-[1.3rem] border border-slate-200 bg-white px-3.5 py-3.5 shadow-sm space-y-3">
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
                        {preDeliverySection === "general" ? (
                          <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Sección General</p>
                            <p className="mt-2 text-sm font-black text-slate-900">Solo controles visuales y operativos del sector.</p>
                            <p className="mt-2 text-xs font-medium text-slate-500">En esta vista no se cargan legajos. Al entrar en Legajos vas a poder ingresar uno y completar su checklist documental.</p>
                          </div>
                        ) : (
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
                              {preDeliveryLegajoCards.map((legajoCard) => (
                                <div
                                  key={`pre-delivery-legajo-card-${legajoCard.index}`}
                                  className={cn(
                                    "w-full rounded-[1.15rem] border p-2.5 text-left transition",
                                    legajoCard.isActive
                                      ? legajoCard.status === "complete"
                                        ? "border-emerald-700 bg-emerald-950 text-white shadow-[0_16px_30px_rgba(6,78,59,0.18)]"
                                        : legajoCard.status === "in-progress"
                                          ? "border-amber-600 bg-amber-950 text-white shadow-[0_16px_30px_rgba(120,53,15,0.18)]"
                                          : "border-slate-900 bg-slate-950 text-white shadow-[0_16px_30px_rgba(15,23,42,0.16)]"
                                      : legajoCard.status === "complete"
                                        ? "border-emerald-200 bg-emerald-50 hover:border-emerald-300"
                                        : legajoCard.status === "in-progress"
                                          ? "border-amber-200 bg-amber-50 hover:border-amber-300"
                                          : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                                  )}
                                >
                                  <button
                                    type="button"
                                    onClick={() => setPreDeliveryActiveLegajoIndex(legajoCard.index)}
                                    className="w-full text-left"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className={cn(
                                          "text-[9px] font-black uppercase tracking-[0.18em]",
                                          legajoCard.isActive
                                            ? legajoCard.status === "complete"
                                              ? "text-emerald-200"
                                              : legajoCard.status === "in-progress"
                                                ? "text-amber-200"
                                                : "text-slate-300"
                                            : legajoCard.status === "complete"
                                              ? "text-emerald-700"
                                              : legajoCard.status === "in-progress"
                                                ? "text-amber-700"
                                                : "text-slate-400"
                                        )}>Legajo {legajoCard.index + 1}</p>
                                        <p className={cn(
                                            "mt-1.5 text-[13px] font-black leading-snug",
                                          legajoCard.isActive ? "text-white" : "text-slate-900"
                                        )}>{legajoCard.trimmedName || "Sin nombre cargado"}</p>
                                      </div>
                                        <div className="space-y-1.5 text-right">
                                        <div className={cn(
                                            "rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em]",
                                          legajoCard.isActive
                                            ? legajoCard.status === "complete"
                                              ? "bg-white/10 text-emerald-100"
                                              : legajoCard.status === "in-progress"
                                                ? "bg-white/10 text-amber-100"
                                                : "bg-white/10 text-white"
                                            : legajoCard.status === "complete"
                                              ? "bg-white text-emerald-700"
                                              : legajoCard.status === "in-progress"
                                                ? "bg-white text-amber-700"
                                                : "bg-white text-slate-600"
                                        )}>
                                          {legajoCard.status === "complete" ? "Completo" : legajoCard.status === "in-progress" ? "En progreso" : "Vacio"}
                                        </div>
                                        <p className={cn(
                                            "text-[10px] font-black",
                                          legajoCard.isActive ? "text-white" : "text-slate-700"
                                        )}>{legajoCard.answeredCount}/{legajoCard.totalCount}</p>
                                      </div>
                                    </div>

                                    <div className={cn(
                                        "mt-2.5 h-1.5 w-full overflow-hidden rounded-full",
                                      legajoCard.isActive ? "bg-white/10" : "bg-white"
                                    )}>
                                      <div
                                        className={cn(
                                          "h-full rounded-full transition-all",
                                          legajoCard.status === "complete"
                                            ? "bg-emerald-500"
                                            : legajoCard.status === "in-progress"
                                              ? "bg-amber-500"
                                              : "bg-slate-300"
                                        )}
                                        style={{ width: `${Math.max(legajoCard.completionRatio * 100, legajoCard.status === "empty" ? 12 : 0)}%` }}
                                      />
                                    </div>
                                  </button>

                                  <div className="mt-2.5 space-y-1.5">
                                    <label className={cn(
                                      "block text-[9px] font-black uppercase tracking-[0.18em]",
                                      legajoCard.isActive
                                        ? legajoCard.status === "complete"
                                          ? "text-emerald-200"
                                          : legajoCard.status === "in-progress"
                                            ? "text-amber-200"
                                            : "text-slate-300"
                                        : legajoCard.status === "complete"
                                          ? "text-emerald-700"
                                          : legajoCard.status === "in-progress"
                                            ? "text-amber-700"
                                            : "text-slate-400"
                                    )}>Nombre de persona o legajo</label>
                                    <input
                                      type="text"
                                      value={legajoCard.name}
                                      onFocus={() => setPreDeliveryActiveLegajoIndex(legajoCard.index)}
                                      onChange={(e) => {
                                        const nextAuditedFileNames = [...auditedFileNames];
                                        nextAuditedFileNames[legajoCard.index] = e.target.value;
                                        setSession({
                                          ...session,
                                          auditedFileNames: nextAuditedFileNames,
                                        });
                                      }}
                                      placeholder={`Nombre del legajo o persona ${legajoCard.index + 1}`}
                                      className={cn(
                                        "w-full rounded-[1rem] border px-3.5 py-2.5 text-[13px] font-bold shadow-sm focus:outline-none",
                                        legajoCard.isActive
                                          ? legajoCard.status === "complete"
                                            ? "border-white/10 bg-white/10 text-white placeholder:text-emerald-100"
                                            : legajoCard.status === "in-progress"
                                              ? "border-white/10 bg-white/10 text-white placeholder:text-amber-100"
                                              : "border-white/10 bg-white/10 text-white placeholder:text-slate-300"
                                          : legajoCard.status === "complete"
                                            ? "border-emerald-200 bg-white text-slate-900"
                                            : legajoCard.status === "in-progress"
                                              ? "border-amber-200 bg-white text-slate-900"
                                              : "border-gray-200 bg-white text-slate-900"
                                      )}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                    <div className={cn("space-y-4 min-w-0 lg:pb-12", isQuickAuditMode ? "pb-64" : "pb-40")}>
                      <div className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm lg:p-4">
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
                                <div className="space-y-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-3 lg:p-4">
                                  <div className="space-y-1 px-1">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Sección General</p>
                                    <h4 className="text-sm font-black text-slate-950">Controles generales del sector</h4>
                                  </div>
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

                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Observaciones</label>
                          <textarea
                            placeholder="Observaciones"
                            value={session.notes || ""}
                            onChange={(e) => setSession({ ...session, notes: e.target.value })}
                            className={cn(
                              "w-full p-6 border rounded-3xl font-medium text-sm focus:outline-none shadow-sm min-h-[160px]",
                              selectedRole === "Ordenes"
                                ? "bg-white border-slate-200 text-slate-700"
                                : "bg-white border-gray-200"
                            )}
                          />

                          <div className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm space-y-4 lg:hidden">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cierre</p>
                              <p className="mt-2 text-sm font-black text-slate-900">Enviar</p>
                              {failItemsWithoutCommentCount > 0 && (
                                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Faltan {failItemsWithoutCommentCount} observaciones obligatorias en desvíos.</p>
                              )}
                            </div>

                            {isOrdersAudit ? (
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
                                      Guardar y seguir con otra OR
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
                        </div>

                        <div className="hidden rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm space-y-4 lg:sticky lg:top-28 lg:block">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cierre</p>
                            <p className="mt-2 text-sm font-black text-slate-900">Enviar</p>
                            {failItemsWithoutCommentCount > 0 && (
                              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Faltan {failItemsWithoutCommentCount} observaciones obligatorias en desvíos.</p>
                            )}
                          </div>

                          {isOrdersAudit ? (
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
                                    Guardar y seguir con otra OR
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
                      <div className="fixed inset-x-0 bottom-[5.75rem] z-40 border-t border-slate-200 bg-white/96 p-3 backdrop-blur-xl lg:hidden">
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

                    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/92 p-3 backdrop-blur-xl lg:hidden">
                      <div className="mx-auto flex max-w-6xl items-center gap-3 rounded-[1.4rem] bg-slate-950 px-4 py-3 text-white shadow-[0_20px_40px_rgba(15,23,42,0.24)]">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cierre</p>
                          <p className="mt-1 text-sm font-black">{sessionItems.length}/{displayedAuditItems.length} respondidos</p>
                          {failItemsWithoutCommentCount > 0 ? (
                            <p className="mt-1 text-[11px] font-bold text-amber-300">Faltan {failItemsWithoutCommentCount} observaciones obligatorias.</p>
                          ) : (
                            <p className="mt-1 text-[11px] font-bold text-slate-400">{draftSaveStateLabel} · Score actual {calculateCurrentScore()}%</p>
                          )}
                        </div>
                        {isOrdersAudit ? (
                          <div className="grid min-w-[230px] grid-cols-1 gap-2">
                            <button
                              onClick={() => handleAuditSubmit("continue")}
                              disabled={isSubmitDisabled}
                              className={cn(
                                "inline-flex items-center justify-center gap-2 rounded-[1rem] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] transition-all",
                                !isSubmitDisabled
                                  ? "bg-white text-slate-950"
                                  : "cursor-not-allowed bg-white/10 text-slate-400"
                              )}
                            >
                              {isSendingToSheet ? (
                                <>
                                  <div className="h-4 w-4 rounded-full border-2 border-slate-400 border-t-slate-900 animate-spin" />
                                  Guardando
                                </>
                              ) : (
                                <>
                                  <Save className="h-4 w-4" />
                                  Guardar y seguir
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleAuditSubmit("finish")}
                              disabled={isSubmitDisabled}
                              className={cn(
                                "inline-flex items-center justify-center gap-2 rounded-[1rem] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] transition-all",
                                !isSubmitDisabled
                                  ? "bg-slate-700 text-white"
                                  : "cursor-not-allowed bg-white/10 text-slate-400"
                              )}
                            >
                              {isSendingToSheet ? (
                                <>
                                  <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-white animate-spin" />
                                  Guardando
                                </>
                              ) : (
                                <>
                                  <Save className="h-4 w-4" />
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
                              "inline-flex min-w-[156px] items-center justify-center gap-2 rounded-[1.1rem] px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] transition-all",
                              !isSubmitDisabled
                                ? "bg-white text-slate-950"
                                : "cursor-not-allowed bg-white/10 text-slate-400"
                            )}
                          >
                            {isSendingToSheet ? (
                              <>
                                <div className="h-4 w-4 rounded-full border-2 border-slate-400 border-t-slate-900 animate-spin" />
                                Enviando
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4" />
                                Enviar
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
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
              <div className="bg-white/90 p-6 rounded-3xl shadow-sm border border-white/80 space-y-4 backdrop-blur">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Integraciones</h3>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Endpoint Apps Script</label>
                    <input
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm focus:outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">CSV publicado de Sheets</label>
                    <input
                      type="url"
                      value={sheetCsvUrl}
                      onChange={(e) => setSheetCsvUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/.../pub?output=csv"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={saveIntegrationSettings}
                    className="px-5 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                  >
                    Guardar configuracion
                  </button>
                </div>
              </div>
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
                />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {(view === "dashboard" || view === "history") && canRunAudits && (
        <button
          onClick={startNewAudit}
          className="fixed bottom-5 right-5 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xl shadow-blue-300/60 transition-all active:scale-95 lg:hidden"
          aria-label="Nueva auditoría"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <AppModal 
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setPendingOrdersSubmitMode("finish");
        }}
        onConfirm={() => submitAudit(pendingOrdersSubmitMode)}
        title={pendingOrdersSubmitMode === "continue" ? "¿Guardar y continuar con otra OR?" : "¿Guardar y finalizar auditoría?"}
        message={pendingOrdersSubmitMode === "continue"
          ? `Quedan ${optionalPendingCount} ítems opcionales sin responder. ¿Deseás guardar esta OR y continuar con otra igualmente?`
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

      {/* Bottom Navigation (Mobile Only) */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 px-6 py-4 flex items-center justify-around z-50 lg:hidden",
        (view === "home" || view === "audit" || view === "setup") ? "flex" : "hidden"
      )}>
        <button 
          onClick={() => setView("dashboard")}
          className={cn(
            "flex flex-col items-center gap-1 transition-all active:scale-90",
            view === "dashboard" ? "text-blue-600" : "text-slate-400"
          )}
        >
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">Panel</span>
        </button>
        <button 
          onClick={startNewAudit}
          disabled={!canRunAudits}
          className={cn(
            "flex flex-col items-center gap-1 transition-all active:scale-90",
            (view === "setup" || view === "audit") ? "text-blue-600" : "text-slate-400"
          )}
        >
          <Plus className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">Nuevo</span>
        </button>
        <button 
          onClick={() => setView("history")}
          className={cn(
            "flex flex-col items-center gap-1 transition-all active:scale-90",
            view === "history" ? "text-blue-600" : "text-slate-400"
          )}
        >
          <History className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">Historial</span>
        </button>
      </nav>
    </div>
  </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuditApp />
    </ErrorBoundary>
  );
}


