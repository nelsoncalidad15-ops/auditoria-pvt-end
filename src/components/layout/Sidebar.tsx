import { memo } from "react";
import { LogOut, Settings, LucideIcon, X } from "lucide-react";
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
  const isActive = (itemId: string) => (itemId === "home" ? view === "setup" || view === "audit" || view === "command-center" : view === itemId);

  const sidebarContent = (isMobile: boolean) => (
    <div className="flex flex-col h-full relative z-10">
      {/* Brand Section */}
      <div className="flex items-center gap-3 px-6 py-10 transition-all duration-300">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[--accent-neon] text-[#050a14] shadow-lg shadow-[--accent-neon-glow]">
          <Settings className="h-6 w-6" />
        </div>
        <motion.div 
          initial={{ opacity: 0, x: -10 }} 
          animate={{ opacity: 1, x: 0 }}
          className="min-w-0"
        >
          <h1 className="text-xl font-black leading-none tracking-tighter text-white uppercase italic">{appTitle}</h1>
          <p className="mt-1.5 text-[9px] font-black uppercase tracking-[0.25em] text-[--accent-neon] neon-text">SYSTEM CORE</p>
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 px-3 py-4">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              onNavigate(item.id);
              if (isMobile) onMobileClose();
            }}
            className={cn(
              "group relative flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 transition-all duration-300",
              isActive(item.id)
                ? "bg-[--accent-neon] text-[#050a14] shadow-xl shadow-[--accent-neon-glow]"
                : "text-white hover:bg-white/10 hover:text-white"
            )}
          >
            <item.icon className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-110 group-active:scale-90", isActive(item.id) ? "text-[#050a14]" : "text-white group-hover:text-white")} />
            <motion.span 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="text-xs font-black uppercase tracking-widest truncate"
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
      <aside
        className={cn(
          "hidden lg:flex flex-col fixed inset-y-0 left-0 z-50 border-r border-white/10 bg-[#111827] shadow-[10px_0_30px_rgba(0,0,0,0.3)]",
          "w-[280px]"
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
        {sidebarContent(false)}
      </aside>

      {/* Desktop Spacer */}
      <div className={cn(
        "hidden lg:block shrink-0 w-[280px]"
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
