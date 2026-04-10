import React from "react";
import { History, LayoutDashboard, LucideIcon, Plus } from "lucide-react";

import { Sidebar } from "../components/layout/Sidebar";
import { Topbar } from "../components/layout/Topbar";
import { cn } from "../lib/utils";
import { AppView, AuditUserProfile } from "../types";

interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface AppShellProps {
  appTitle: string;
  view: AppView;
  user: { displayName?: string | null; email?: string | null } | null;
  userProfile: AuditUserProfile;
  authenticationEnabled: boolean;
  showSidebar: boolean;
  sidebarItems: SidebarItem[];
  isMobileNavOpen: boolean;
  canRunAudits: boolean;
  contentContainerRef: React.RefObject<HTMLDivElement | null>;
  onNavigate: (view: AppView | "home") => void;
  onLogout: () => void;
  onOpenMobileNav: () => void;
  onCloseMobileNav: () => void;
  onBack: () => void;
  onStartAudit: () => void;
  backLabel?: string;
  children: React.ReactNode;
}

function getMainClassName(view: AppView) {
  if (view === "dashboard") return "max-w-7xl mx-auto w-full";
  if (view === "setup") return "max-w-5xl mx-auto w-full pb-32";
  if (view === "audit") return "max-w-7xl mx-auto w-full pb-28 pt-2 md:pt-4";
  if (view === "structure" || view === "integrations") return "max-w-6xl mx-auto w-full pb-12";
  if (view === "continuar") return "max-w-6xl mx-auto w-full pb-28";
  if (view === "home") return "max-w-md mx-auto w-full pb-32";
  return "max-w-md mx-auto w-full lg:max-w-4xl lg:mx-0";
}

export function AppShell({
  appTitle,
  view,
  user,
  userProfile,
  authenticationEnabled,
  showSidebar,
  sidebarItems,
  isMobileNavOpen,
  canRunAudits,
  contentContainerRef,
  onNavigate,
  onLogout,
  onOpenMobileNav,
  onCloseMobileNav,
  onBack,
  onStartAudit,
  backLabel,
  children,
}: AppShellProps) {
  return (
    <div className="app-shell min-h-screen lg:min-h-[180vh] 2xl:min-h-[220vh] lg:flex">
      <Sidebar
        appTitle={appTitle}
        show={showSidebar}
        view={view}
        isMobileOpen={isMobileNavOpen}
        items={sidebarItems}
        user={user}
        onNavigate={(id) => onNavigate(id as AppView | "home")}
        onMobileClose={onCloseMobileNav}
        onLogout={onLogout}
      />

      <div ref={contentContainerRef} className="flex-1 flex flex-col min-h-[100dvh] lg:min-h-[180vh] 2xl:min-h-[220vh] overflow-y-visible lg:overflow-y-auto">
        <Topbar
          appTitle={appTitle}
          view={view}
          user={user}
          userProfile={userProfile}
          onUserProfileChange={() => {}}
          authenticationEnabled={authenticationEnabled}
          showMenuButton={showSidebar}
          showBackButton={view !== "dashboard"}
          backLabel={backLabel}
          onOpenMenu={onOpenMobileNav}
          onBack={onBack}
          onLogin={() => {}}
        />

        <main className={cn("p-4 md:p-8 transition-all duration-500", getMainClassName(view))}>
          {children}
        </main>

        {(view === "dashboard" || view === "history") && canRunAudits && (
          <button
            onClick={onStartAudit}
            className="fixed bottom-5 right-5 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xl shadow-blue-300/60 transition-all active:scale-95 lg:hidden"
            aria-label="Nueva auditoria"
          >
            <Plus className="h-6 w-6" />
          </button>
        )}

        <nav
          className={cn(
            "fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 px-6 py-4 flex items-center justify-around z-50 lg:hidden",
            view === "dashboard" || view === "history" || view === "home" || view === "setup" || view === "continuar" ? "flex" : "hidden"
          )}
        >
          <button
            onClick={() => onNavigate("dashboard")}
            className={cn("flex flex-col items-center gap-1 transition-all active:scale-90", view === "dashboard" ? "text-blue-600" : "text-slate-400")}
          >
            <LayoutDashboard className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-widest">Panel</span>
          </button>
          <button
            onClick={onStartAudit}
            disabled={!canRunAudits}
            className={cn("flex flex-col items-center gap-1 transition-all active:scale-90", view === "home" || view === "setup" || view === "audit" ? "text-blue-600" : "text-slate-400")}
          >
            <Plus className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-widest">Nuevo</span>
          </button>
          <button
            onClick={() => onNavigate("history")}
            className={cn("flex flex-col items-center gap-1 transition-all active:scale-90", view === "history" ? "text-blue-600" : "text-slate-400")}
          >
            <History className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-widest">Historial</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
