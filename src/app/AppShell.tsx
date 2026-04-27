import React from "react";
import { History, LayoutDashboard, LucideIcon, Plus, Home } from "lucide-react";
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
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#050a14] transition-colors duration-500 overflow-x-hidden relative">
      {/* Premium Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-40 dark:opacity-100">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] dark:bg-blue-900/20" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[--accent-neon-glow] rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] dark:opacity-[0.05]" />
        <div 
          className="absolute inset-0" 
          style={{ 
            backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
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

      <div ref={contentContainerRef} className="flex-1 flex flex-col min-h-[100dvh] relative">
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

        <main className={cn("p-4 md:p-8 flex-1 transition-all duration-300", getMainClassName(view))}>
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
            "fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-t border-slate-200/50 dark:border-slate-800/50 px-8 py-3 flex items-center justify-around z-[80] lg:hidden safe-area-bottom shadow-[0_-10px_40px_rgba(0,0,0,0.05)]",
            view === "audit" ? "hidden" : "flex"
          )}
        >
          <button
            onClick={() => onNavigate("home")}
            className={cn("flex flex-col items-center gap-1 transition-all active:scale-75", (view === "home" || view === "command-center") ? "text-blue-600" : "text-slate-400")}
          >
            <Home className="w-6 h-6" />
            <span className="text-[9px] font-black uppercase tracking-widest">Inicio</span>
          </button>
          
          <button
            onClick={onStartAudit}
            disabled={!canRunAudits}
            className="flex flex-col items-center -mt-10"
          >
            <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-xl shadow-blue-500/40 active:scale-90 transition-transform">
              <Plus className="w-7 h-7" />
            </div>
          </button>

          <button
            onClick={() => onNavigate("history")}
            className={cn("flex flex-col items-center gap-1 transition-all active:scale-75", view === "history" ? "text-blue-600" : "text-slate-400")}
          >
            <History className="w-6 h-6" />
            <span className="text-[9px] font-black uppercase tracking-widest">Historial</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
