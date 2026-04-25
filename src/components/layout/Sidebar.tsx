import { memo, useState } from "react";
import { LucideIcon, LogOut, Settings, X, Menu, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "../../lib/utils";

interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface SidebarProps {
  appTitle: string;
  show: boolean;
  view: string;
  isMobileOpen: boolean;
  items: SidebarItem[];
  user: { displayName?: string | null; email?: string | null } | null;
  onNavigate: (id: string) => void;
  onMobileClose: () => void;
  onLogout: () => void;
}

function SidebarBase({ appTitle, show, view, isMobileOpen, items, user, onNavigate, onMobileClose, onLogout }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isActive = (itemId: string) => (itemId === "home" ? view === "setup" || view === "audit" || view === "command-center" : view === itemId);

  const sidebarContent = (isMobile: boolean) => (
    <div className="flex flex-col h-full">
      {/* Brand Section */}
      <div className={cn(
        "flex items-center gap-3 px-6 py-8 transition-all duration-300",
        !isExpanded && !isMobile ? "px-4 justify-center" : "px-6"
      )}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
          <Settings className="h-5 w-5" />
        </div>
        {(isExpanded || isMobile) && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }} 
            animate={{ opacity: 1, x: 0 }}
            className="min-w-0"
          >
            <h1 className="text-lg font-black leading-none tracking-tight text-white">{appTitle}</h1>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-blue-200/50">Panel de Control</p>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              onNavigate(item.id);
              if (isMobile) onMobileClose();
            }}
            className={cn(
              "group relative flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition-all duration-200",
              isActive(item.id)
                ? "bg-white text-slate-900 shadow-xl shadow-black/10"
                : "text-slate-400 hover:bg-white/5 hover:text-white",
              !isExpanded && !isMobile && "justify-center"
            )}
          >
            <item.icon className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-110", isActive(item.id) ? "text-blue-600" : "text-slate-400")} />
            {(isExpanded || isMobile) && (
              <motion.span 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                className="text-sm font-bold truncate"
              >
                {item.label}
              </motion.span>
            )}
            {!isExpanded && !isMobile && (
              <div className="absolute left-14 rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100] border border-white/10 shadow-2xl">
                {item.label}
              </div>
            )}
          </button>
        ))}
      </nav>

      {/* User Section */}
      {user && (
        <div className={cn(
          "p-4 border-t border-white/5 bg-black/20 backdrop-blur-sm transition-all duration-300",
          !isExpanded && !isMobile ? "px-2" : "px-4"
        )}>
          <div className={cn(
            "flex items-center gap-3 mb-4",
            !isExpanded && !isMobile ? "justify-center" : ""
          )}>
            <div className="h-10 w-10 shrink-0 rounded-xl bg-white/10 flex items-center justify-center text-white font-black">
              {user.displayName?.charAt(0) || "U"}
            </div>
            {(isExpanded || isMobile) && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{user.displayName}</p>
                <p className="text-[9px] text-white/40 truncate">{user.email}</p>
              </motion.div>
            )}
          </div>
          <button
            onClick={() => {
              onLogout();
              if (isMobile) onMobileClose();
            }}
            className={cn(
              "flex w-full items-center justify-center gap-2 py-2.5 rounded-xl border border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/60 hover:bg-red-500/20 hover:text-red-300 transition-all",
              !isExpanded && !isMobile ? "px-0" : "px-4"
            )}
          >
            <LogOut className="h-4 w-4" />
            {(isExpanded || isMobile) && <span>Cerrar Sesión</span>}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Rail) */}
      <aside
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        className={cn(
          "hidden lg:flex flex-col fixed inset-y-0 left-0 z-50 bg-slate-950 border-r border-white/5 transition-all duration-300 ease-in-out",
          isExpanded ? "w-[260px]" : "w-[80px]",
          !show && "translate-x-[-100%]"
        )}
      >
        {sidebarContent(false)}
      </aside>

      {/* Desktop Spacer */}
      <div className={cn(
        "hidden lg:block shrink-0 transition-all duration-300 ease-in-out",
        show ? (isExpanded ? "w-[260px]" : "w-[80px]") : "w-0"
      )} />

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileOpen && show && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative h-full w-[280px] bg-slate-950 text-white shadow-2xl"
            >
              <button
                onClick={onMobileClose}
                className="absolute right-4 top-6 p-2 rounded-xl bg-white/5 text-white"
              >
                <X className="h-5 w-5" />
              </button>
              {sidebarContent(true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export const Sidebar = memo(SidebarBase);
