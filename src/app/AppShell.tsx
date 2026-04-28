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
  if (view === "structure" || view === "integrations") return "max-w-[1440px] mx-auto w-full pb-12";
  if (view === "continuar") return "max-w-6xl mx-auto w-full pb-28";
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
    <div className="min-h-screen flex bg-[--bg] transition-colors duration-500 overflow-x-hidden relative">
      {/* Premium Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-40 dark:opacity-100">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
        <div 
          className="absolute inset-0" 
          style={{ 
            backgroundImage: `linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }} 
        />
      </div>

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

      <div ref={contentContainerRef} className="flex-1 flex flex-col min-h-[100dvh] relative lg:pl-[280px]">
        <Topbar
          appTitle={appTitle}
          view={view}
          user={user}
          userProfile={userProfile}
          onUserProfileChange={() => {}}
          authenticationEnabled={authenticationEnabled}
          showMenuButton={showSidebar}
          showBackButton={view !== "home" && view !== "command-center"}
          backLabel={backLabel}
          onOpenMenu={onOpenMobileNav}
          onBack={onBack}
          onLogin={() => {}}
        />

        <main className={cn("px-4 pb-4 pt-2 md:px-8 md:pb-8 md:pt-4 flex-1 transition-all duration-300 relative z-10", getMainClassName(view))}>
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
