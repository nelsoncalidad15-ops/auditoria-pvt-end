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

function TopbarBase({ appTitle, view, user, userProfile, showMenuButton = false, showBackButton = false, backLabel, onOpenMenu, onBack }: TopbarProps) {
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
    <header className={cn("sticky top-0 z-40 border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.88))] px-4 backdrop-blur-xl md:px-6", isAuditView ? "py-3" : "py-4")}>
      <div
        className={cn(
          "mx-auto flex items-center justify-between gap-4",
          view === "dashboard" ? "max-w-7xl" : view === "setup" ? "max-w-5xl" : view === "audit" ? "max-w-6xl" : view === "home" ? "max-w-md" : "max-w-md lg:max-w-none",
        )}
      >
        <div className={cn("flex items-center gap-3", (view === "home" || view === "audit" || view === "setup") ? "flex" : "lg:hidden flex")}>
          {showBackButton && onBack && (
            <button
              onClick={onBack}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 text-slate-700 shadow-[0_10px_26px_rgba(15,23,42,0.05)]"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-[10px] font-black uppercase tracking-[0.16em]">
                {backLabel || (isAuditView ? "Volver a áreas" : "Volver")}
              </span>
            </button>
          )}
          {showMenuButton && (
            <button
              onClick={onOpenMenu}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-slate-700 shadow-[0_10px_26px_rgba(15,23,42,0.05)] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div className="rounded-2xl bg-slate-950 p-2.5 shadow-[0_12px_28px_rgba(15,23,42,0.16)]">
            <ClipboardCheck className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="font-black text-sm tracking-tight leading-none uppercase text-slate-950">{appTitle}</h1>
            <p className="mt-1 hidden text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 sm:block">{viewLabel}</p>
          </div>
        </div>

        <div className={cn("hidden min-w-0 lg:block", (view === "dashboard" || view === "history" || view === "structure" || view === "integrations") ? "lg:block" : "lg:hidden")}>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            <span>{viewLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center rounded-xl border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700">
            {USER_PROFILE_LABELS[userProfile]}
          </span>
          {user && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-[11px] font-black text-slate-700 border border-slate-200">
              {user.displayName?.charAt(0) ?? "U"}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export const Topbar = memo(TopbarBase);

