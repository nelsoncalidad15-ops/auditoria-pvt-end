import { memo } from "react";
import { ArrowLeft, Menu } from "lucide-react";
import { cn } from "../../lib/utils";
import { AuditUserProfile } from "../../types";
import { ThemeToggle } from "../common/ThemeToggle";

const USER_PROFILE_LABELS: Record<AuditUserProfile, string> = {
  auditor: "Auditor",
  supervisor: "Supervisor",
  consulta: "Consulta",
};

interface TopbarProps {
  appTitle: string;
  view: string;
  user: { displayName?: string | null } | null;
  userProfile: AuditUserProfile;
  syncStatusLabel?: string;
  syncStatusDetail?: string;
  syncStatusTone?: "success" | "warning" | "neutral";
  isSyncing?: boolean;
  onUserProfileChange: (profile: AuditUserProfile) => void;
  authenticationEnabled?: boolean;
  showMenuButton?: boolean;
  showBackButton?: boolean;
  backLabel?: string;
  onOpenMenu?: () => void;
  onBack?: () => void;
  onLogin: () => void;
}

function TopbarBase({
  appTitle,
  view,
  user,
  userProfile,
  syncStatusLabel = "Sin configurar",
  syncStatusDetail,
  syncStatusTone = "neutral",
  isSyncing = false,
  showMenuButton = false,
  showBackButton = false,
  backLabel,
  onOpenMenu,
  onBack,
}: TopbarProps) {
  const isAuditView = view === "audit";
  const viewLabel =
    view === "dashboard"
      ? "Dashboard"
      : view === "home"
        ? "Inicio"
        : view === "history"
          ? "Historial"
          : view === "continuar"
            ? "Pendientes"
            : view === "structure"
              ? "Estructura"
              : view === "integrations"
                ? "Integraciones"
                : view === "stock-control"
                  ? "Control físico"
                  : view === "setup"
                  ? "Configuración"
                  : view === "audit"
                    ? "Auditoría"
                    : "Nueva auditoría";

  const syncToneClass =
    syncStatusTone === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20"
      : syncStatusTone === "warning"
        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20"
        : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800";
  const syncDotClass =
    syncStatusTone === "success"
      ? "bg-emerald-500"
      : syncStatusTone === "warning"
        ? "bg-amber-500"
        : "bg-slate-400";

  return (
    <header className={cn("sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-[#e2e9f0] transition-all duration-300", isAuditView ? "py-1.5" : "py-2.5")}>
      <div
        className={cn(
          "mx-auto flex items-center justify-between gap-3 px-4 md:px-6",
          view === "dashboard" ? "max-w-7xl" : view === "setup" ? "max-w-5xl" : view === "audit" ? "max-w-6xl" : view === "home" ? "max-w-7xl" : "max-w-7xl",
        )}
      >
        <div className="flex items-center gap-3">
          {showBackButton && onBack && (
            <button
              onClick={onBack}
              className="h-9 px-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] uppercase tracking-wider hover:border-[#90b2cc] hover:text-[#001e50] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{backLabel || (isAuditView ? "Áreas" : "Volver")}</span>
            </button>
          )}
          {showMenuButton && (
            <button
              onClick={onOpenMenu}
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#001e50] text-[#001e50] text-[9px] font-black italic">VW</div>
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-[#001e50] truncate tracking-tight">{appTitle}</h2>
              <p className="text-[8px] font-bold text-[#4e7896] uppercase tracking-[0.16em]">{viewLabel}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div 
            title={syncStatusDetail ? `${syncStatusLabel} • ${syncStatusDetail}` : syncStatusLabel}
            className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-all cursor-default", syncToneClass)}
          >
            <div className={cn("h-2 w-2 rounded-full shrink-0", syncDotClass, isSyncing && "animate-pulse")} />
            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
              {isSyncing ? "Sincronizando..." : (syncStatusTone === "success" ? "Conectado" : syncStatusLabel)}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {USER_PROFILE_LABELS[userProfile]}
            </span>
          </div>

          <ThemeToggle />
          
          {user && (
            <div className="flex items-center gap-2 p-1 pl-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50">
              <span className="hidden sm:inline text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate max-w-[120px]">
                {user.displayName}
              </span>
              <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-black">
                {user.displayName?.charAt(0) ?? "U"}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export const Topbar = memo(TopbarBase);
