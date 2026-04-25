import { memo } from "react";
import { ArrowLeft, ClipboardCheck, Menu } from "lucide-react";
import { cn } from "../../lib/utils";
import { AuditUserProfile } from "../../types";

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
            ? "Continuar"
            : view === "structure"
              ? "Estructura"
              : view === "integrations"
                ? "Integraciones"
                : view === "setup"
                  ? "Configuración"
                  : view === "audit"
                    ? "Auditoría"
                    : "Nueva auditoría";

  return (
    <header className={cn("sticky top-0 z-40 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 transition-all duration-300", isAuditView ? "py-2" : "py-4")}>
      <div
        className={cn(
          "mx-auto flex items-center justify-between gap-4 px-4 md:px-8",
          view === "dashboard" ? "max-w-7xl" : view === "setup" ? "max-w-5xl" : view === "audit" ? "max-w-6xl" : view === "home" ? "max-w-7xl" : "max-w-7xl",
        )}
      >
        <div className="flex items-center gap-4">
          {showBackButton && onBack && (
            <button
              onClick={onBack}
              className="h-10 px-4 flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
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
            <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-slate-900 dark:text-white truncate uppercase tracking-tight">{appTitle}</h2>
              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">{viewLabel}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {USER_PROFILE_LABELS[userProfile]}
            </span>
          </div>
          
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
