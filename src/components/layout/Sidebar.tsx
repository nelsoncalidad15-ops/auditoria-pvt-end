import { memo } from "react";
import { LogOut, LucideIcon, X } from "lucide-react";
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

function SidebarBase({ show, view, isMobileOpen, items, user, onNavigate, onMobileClose, onLogout }: SidebarProps) {
  const isActive = (itemId: string) => (itemId === "home" ? view === "setup" || view === "audit" || view === "command-center" : view === itemId);

  const sidebarContent = (isMobile: boolean) => (
    <div className="flex flex-col h-full relative z-10">
      {/* Brand Section */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10 transition-all duration-300">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/50 text-white text-[11px] font-black italic">VW</div>
        <motion.div 
          initial={{ opacity: 0, x: -10 }} 
          animate={{ opacity: 1, x: 0 }}
          className="min-w-0"
        >
          <h1 className="text-sm font-bold leading-tight tracking-tight text-white">Autosol Auditoría</h1>
          <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.2em] text-[#7fbae0]">Control operativo</p>
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === "setup" && typeof window !== "undefined") {
                window.location.hash = "#/nueva";
              }
              onNavigate(item.id);
              if (isMobile) onMobileClose();
            }}
            className={cn(
              "group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 transition-all duration-200",
              isActive(item.id)
                ? "bg-white text-[#001e50] shadow-sm"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            )}
          >
            <item.icon className={cn("h-[17px] w-[17px] shrink-0", isActive(item.id) ? "text-[#001e50]" : "text-slate-400 group-hover:text-white")} />
            <motion.span 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="text-[10px] font-bold uppercase tracking-[0.12em] truncate"
            >
              {item.label}
            </motion.span>
          </button>
        ))}
      </nav>

      {/* User Section */}
      {user && (
        <div className="p-6 border-t border-white/5 bg-black/40 backdrop-blur-md transition-all duration-300 rounded-t-3xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 shrink-0 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white font-black group-hover:border-[--accent-neon] transition-colors">
              {user.displayName?.charAt(0) || "U"}
            </div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0">
              <p className="text-sm font-black text-white truncate tracking-tight">{user.displayName}</p>
              <p className="text-[10px] text-slate-500 truncate uppercase tracking-widest mt-0.5">{user.email}</p>
            </motion.div>
          </div>
          <button
            onClick={() => {
              onLogout();
              if (isMobile) onMobileClose();
            }}
            className="flex w-full items-center justify-center gap-3 py-3.5 px-4 rounded-2xl border border-red-500/10 bg-red-500/5 text-[10px] font-black uppercase tracking-[0.2em] text-red-400 hover:bg-red-500 hover:text-white transition-all shadow-lg active:scale-95"
          >
            <LogOut className="h-4 w-4" />
            <span>SIGN OUT</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      {show && (
        <aside
          className={cn(
            "hidden lg:flex flex-col fixed inset-y-0 left-0 z-50 border-r border-[#173963] bg-[#001e50] shadow-[8px_0_24px_rgba(0,30,80,0.12)]",
            "w-[236px]"
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
          {sidebarContent(false)}
        </aside>
      )}

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileOpen && show && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative h-full w-[300px] bg-[#050a14] text-white shadow-2xl border-r border-white/5 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent pointer-events-none" />
              <button
                onClick={onMobileClose}
                className="absolute right-6 top-10 p-2.5 rounded-2xl bg-white/5 text-white z-50"
              >
                <X className="h-6 w-6" />
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
