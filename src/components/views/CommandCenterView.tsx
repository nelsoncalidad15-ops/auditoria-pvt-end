import { 
  Activity, 
  ArrowRight, 
  ClipboardCheck, 
  History as HistoryIcon, 
  Settings2, 
} from "lucide-react";
import { cn } from "../../lib/utils";
import { AuditSession } from "../../types";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from "recharts";

interface CommandCenterViewProps {
  history: AuditSession[];
  onStartAudit: () => void;
  onOpenHistory: () => void;
  onOpenStructure: () => void;
}

export function CommandCenterView({
  history,
  onStartAudit,
  onOpenHistory,
  onOpenStructure,
}: CommandCenterViewProps) {
  // Derive average compliance
  const avgCompliance = Math.round(history.reduce((acc, s) => acc + s.totalScore, 0) / (history.length || 1));

  // Derive trend data for sparklines
  const trendData = history.slice(-10).map((s) => ({
    score: s.totalScore
  }));

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Welcome Header */}
      <div className="px-4 py-8 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 shadow-xl dark:shadow-2xl relative overflow-hidden mb-8">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] dark:opacity-10">
          <Activity className="w-40 h-40 text-blue-600 dark:text-blue-500" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-1.5 w-12 rounded-full bg-blue-600 dark:bg-blue-500 shadow-lg dark:shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
            <span className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500 dark:text-blue-400/80">Control System v4.0</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">
            WELCOME, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400 dark:from-blue-400 dark:to-cyan-300">OPERATOR</span>
          </h2>
          <div className="flex items-center gap-4 mt-6 text-slate-500 dark:text-slate-400">
            <p className="text-sm font-bold uppercase tracking-widest bg-slate-100 dark:bg-white/5 px-4 py-1.5 rounded-full border border-slate-200 dark:border-white/5">
              {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            <p className="text-xs font-medium italic opacity-70">Sincronización en tiempo real activa</p>
          </div>
        </div>
      </div>

      {/* Main Grid Layout with Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        
        {/* Modules Column */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 content-start">
          
          {/* Module 1: Quality Monitoring */}
          <div className="glass-container p-6 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-blue-500">
                  <Activity className="h-5 w-5" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">QUALITY</h3>
              </div>
              <div className="px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[9px] font-black uppercase tracking-widest animate-pulse">
                LIVE
              </div>
            </div>
            
            <div className="flex items-end justify-between gap-4 mb-8">
              <div className="h-[60px] flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} fill="#3b82f6" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-white tracking-tighter">{avgCompliance}%</p>
              </div>
            </div>
            
            <button onClick={onOpenHistory} className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-blue-500 hover:text-[#050a14] hover:border-blue-500 transition-all">
              DETAILS
            </button>
          </div>

          {/* Module 2: Field Audits */}
          <div className="glass-container p-6 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-blue-400">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">AUDITS</h3>
              </div>
              <Settings2 className="h-4 w-4 text-slate-600" />
            </div>

            <div className="space-y-4 mb-8">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <span>Active</span>
                  <span>{history.length}</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '65%' }} />
                </div>
              </div>
            </div>
            
            <button onClick={onStartAudit} className="w-full py-3 rounded-xl bg-blue-500 text-[#050a14] font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all">
              ACCESS
            </button>
          </div>

          {/* Module 3: Historical Reports */}
          <div className="glass-container p-6 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-purple-400">
                  <HistoryIcon className="h-5 w-5" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">REPORTS</h3>
              </div>
            </div>

            <div className="flex gap-4 mb-8">
               <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex-1">
                 <p className="text-2xl font-black text-white">{history.length}</p>
                 <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">Total</p>
               </div>
               <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex-1">
                 <p className="text-2xl font-black text-white">{history.filter(s => s.totalScore < 70).length}</p>
                 <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">Issues</p>
               </div>
            </div>
            
            <button onClick={onOpenHistory} className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-white/10 transition-all">
              HISTORY
            </button>
          </div>

          {/* Module 4: System Configuration */}
          <div className="glass-container p-6 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-emerald-400">
                  <Settings2 className="h-5 w-5" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">SETUP</h3>
              </div>
            </div>

            <div className="flex items-center gap-6 mb-8">
              <div className="relative h-16 w-16">
                <svg className="h-full w-full" viewBox="0 0 36 36">
                  <path className="text-white/5" strokeDasharray="100, 100" stroke="currentColor" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="text-emerald-500" strokeDasharray="85, 100" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">READY</div>
              </div>
            </div>
            
            <button onClick={onOpenStructure} className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-white/10 transition-all">
              CONFIG
            </button>
          </div>
        </div>

        {/* Activity Sidebar */}
        <div className="glass-container p-6 flex flex-col h-full bg-white/[0.01]">
          <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-2">
               <div className="h-2 w-2 rounded-full bg-blue-500 neon-glow" />
               <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">ACTIVITY LOG</h3>
             </div>
          </div>
          
          <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {history.slice(0, 8).map((item) => (
              <div key={item.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between group cursor-pointer hover:bg-white/5 transition-all">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center text-[10px] font-black border",
                    item.totalScore >= 90 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
                  )}>
                    {item.totalScore}%
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-white truncate">{item.location}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">{item.date}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-700 group-hover:text-blue-500 transition-colors" />
              </div>
            ))}
          </div>
          
          <button onClick={onOpenHistory} className="mt-6 w-full py-3 rounded-xl border border-white/5 bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">
            FULL LOGS
          </button>
        </div>
      </div>
    </div>
  );
}
