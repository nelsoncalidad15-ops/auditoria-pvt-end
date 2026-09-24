import React from "react";
import { History, LayoutDashboard, LucideIcon, Plus } from "lucide-react";
import { Sidebar } from "../components/layout/Sidebar";
import { Topbar } from "../components/layout/Topbar";
import { cn } from "../lib/utils";
import { AppView, AuditUserProfile } from "../types";
import { motion, AnimatePresence } from "motion/react";

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
  syncStatusLabel?: string;
  syncStatusDetail?: string;
  syncStatusTone?: "success" | "warning" | "neutral";
  isSyncing?: boolean;
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
  if (view === "dashboard" || view === "command-center" || view === "home") return "max-w-7xl mx-auto w-full";
  if (view === "setup") return "max-w-5xl mx-auto w-full pb-32";
  if (view === "audit") return "max-w-7xl mx-auto w-full pb-28 pt-2 md:pt-4";
  if (view === "structure" || view === "integrations" || view === "stock-control") return "max-w-[1440px] mx-auto w-full pb-12";
  if (view === "continuar") return "max-w-6xl mx-auto w-full pb-28";
  return "max-w-md mx-auto w-full lg:max-w-4xl lg:mx-0";
}

export function AppShell({
  appTitle,
  view,
  user,
  userProfile,
  syncStatusLabel,
  syncStatusDetail,
  syncStatusTone,
  isSyncing,
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
    <div className="audit-app-shell min-h-screen flex transition-colors duration-300 overflow-x-hidden relative">
      {/* Premium Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-[linear-gradient(180deg,#f8fafc_0%,#f3f6fa_100%)]" />

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

      <div ref={contentContainerRef} className={cn("flex-1 flex flex-col min-h-[100dvh] relative", showSidebar && "lg:pl-[236px]")}>
        <Topbar
          appTitle={appTitle}
          view={view}
          user={user}
          userProfile={userProfile}
          syncStatusLabel={syncStatusLabel}
          syncStatusDetail={syncStatusDetail}
          syncStatusTone={syncStatusTone}
          isSyncing={isSyncing}
          onUserProfileChange={() => {}}
          authenticationEnabled={authenticationEnabled}
          showMenuButton={showSidebar}
          showBackButton={view !== "dashboard" && view !== "home" && view !== "command-center"}
          backLabel={backLabel}
          onOpenMenu={onOpenMobileNav}
          onBack={onBack}
          onLogin={() => {}}
        />

        <main className={cn("audit-app-main px-4 pb-4 md:px-6 md:pb-6 flex-1 transition-all duration-300 relative z-10", getMainClassName(view))}>
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav
          className={cn(
            "fixed bottom-0 left-0 right-0 bg-[#0b1120]/80 backdrop-blur-2xl border-t border-white/5 px-8 py-4 flex items-center justify-around z-[80] lg:hidden safe-area-bottom shadow-[0_-10px_40px_rgba(0,0,0,0.4)]",
            view === "audit" ? "hidden" : "flex"
          )}
        >
          <button
            onClick={() => onNavigate("dashboard")}
            className={cn("flex flex-col items-center gap-1.5 transition-all active:scale-75", view === "dashboard" ? "text-blue-400" : "text-slate-500")}
          >
            <LayoutDashboard className="w-6 h-6" />
            <span className="text-[9px] font-black uppercase tracking-widest">Dashboard</span>
          </button>
          
          <button
            onClick={onStartAudit}
            disabled={!canRunAudits}
            className="flex flex-col items-center -mt-12"
          >
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-4.5 rounded-2xl shadow-2xl shadow-blue-500/40 active:scale-90 transition-transform border border-white/10">
              <Plus className="w-7 h-7" />
            </div>
          </button>

          <button
            onClick={() => onNavigate("history")}
            className={cn("flex flex-col items-center gap-1.5 transition-all active:scale-75", view === "history" ? "text-blue-400" : "text-slate-500")}
          >
            <History className="w-6 h-6" />
            <span className="text-[9px] font-black uppercase tracking-widest">Historial</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
