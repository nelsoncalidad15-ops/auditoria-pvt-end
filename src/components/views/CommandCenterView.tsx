import { 
  Activity, 
  ArrowRight, 
  ClipboardCheck, 
  History as HistoryIcon, 
  Settings2,
  FileText 
} from "lucide-react";
import { cn } from "../../lib/utils";
import { AuditSession } from "../../types";

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

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Integrated Professional Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-10 rounded-full bg-blue-600 dark:bg-blue-500 shadow-lg" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 dark:text-blue-400/80">System Core v4.0</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">
            WELCOME, <span className="text-blue-600 dark:text-blue-400">OPERATOR</span>
          </h2>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400/80">Live Sync Active</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-white dark:bg-white/5 p-2 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
           <div className="px-4 py-2 border-r border-slate-100 dark:border-white/5">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Auditorías Hoy</p>
              <p className="text-lg font-black text-slate-900 dark:text-white">{history.length}</p>
           </div>
           <div className="px-4 py-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Calidad Promedio</p>
              <p className="text-lg font-black text-emerald-600">{avgCompliance}%</p>
           </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Core Controls */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quick Access: Quality */}
            <div className="premium-card group bg-white dark:bg-slate-900 border-white/5 p-6 hover:border-blue-500/50 transition-all shadow-xl">
              <div className="flex items-start justify-between mb-8">
                <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Activity className="h-6 w-6" />
                </div>
                <div className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Live Status</div>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Indicador de Calidad</p>
              <h4 className="text-4xl font-black text-slate-900 dark:text-white mb-6">{avgCompliance}<span className="text-lg text-slate-400 font-bold">%</span></h4>
              <button 
                onClick={onOpenHistory}
                className="w-full py-4 rounded-[1.25rem] bg-slate-50 dark:bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 transition-all"
              >
                Ver Detalles
              </button>
            </div>

            {/* Quick Access: Active Audits */}
            <div className="premium-card group bg-white dark:bg-slate-900 border-white/5 p-6 hover:border-blue-500/50 transition-all shadow-xl">
              <div className="flex items-start justify-between mb-8">
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <ClipboardCheck className="h-6 w-6" />
                </div>
                <button className="h-8 w-8 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 hover:text-blue-500 transition-colors">
                   <Settings2 className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Auditorías en Curso</p>
              <div className="flex items-end justify-between mb-6">
                <h4 className="text-4xl font-black text-slate-900 dark:text-white">00</h4>
                <div className="h-2 w-24 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-2">
                   <div className="h-full w-0 bg-emerald-500" />
                </div>
              </div>
              <button 
                onClick={onStartAudit}
                className="w-full py-4 rounded-[1.25rem] bg-blue-600 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                Acceso Rápido
              </button>
            </div>
          </div>

          {/* Secondary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="premium-card bg-white dark:bg-slate-900 border-white/5 p-6 shadow-xl">
                <div className="flex items-center gap-4 mb-6">
                   <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                      <FileText className="h-5 w-5" />
                   </div>
                   <h5 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Reportes Mensuales</h5>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                      <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Emitidos</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white">{history.length}</p>
                   </div>
                   <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                      <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Críticos</p>
                      <p className="text-xl font-black text-red-500">{history.filter(s => s.totalScore < 70).length}</p>
                   </div>
                </div>
             </div>

             <div className="premium-card bg-white dark:bg-slate-900 border-white/5 p-6 shadow-xl">
                <div className="flex items-center gap-4 mb-6">
                   <div className="h-10 w-10 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                      <Settings2 className="h-5 w-5" />
                   </div>
                   <h5 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">System Config</h5>
                </div>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                   <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-black text-center">READY</div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Cloud Sync OK</p>
                   </div>
                   <button 
                    onClick={onOpenStructure}
                    className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-500"
                   >
                    Config
                   </button>
                </div>
             </div>
          </div>
        </div>

        {/* Right Column: Activity / Logs */}
        <div className="lg:col-span-4">
          <div className="premium-card bg-white dark:bg-slate-900 border-white/5 h-full flex flex-col shadow-xl">
            <div className="p-6 border-b border-slate-100 dark:border-white/5">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                     <h5 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">Activity Log</h5>
                  </div>
                  <button onClick={onOpenHistory} className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-500">Full Logs</button>
               </div>
            </div>
            <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[600px] custom-scrollbar">
               {history.slice(0, 8).map((item) => (
                  <div key={item.id} className="flex gap-4 group cursor-pointer" onClick={onOpenHistory}>
                     <div className={cn(
                       "h-10 w-1 rounded-full transition-colors",
                       item.totalScore >= 90 ? "bg-emerald-500" : item.totalScore >= 70 ? "bg-blue-500" : "bg-red-500"
                     )} />
                     <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.date}</p>
                        <p className="text-[13px] font-bold text-slate-700 dark:text-slate-300 leading-tight">Auditoría: <span className="text-blue-600 dark:text-blue-400">{item.location}</span></p>
                        <p className="text-[11px] font-medium text-slate-500">Puntaje: {item.totalScore}%</p>
                     </div>
                  </div>
               ))}
               {history.length === 0 && (
                 <div className="flex flex-col items-center justify-center py-12 text-center">
                    <HistoryIcon className="h-10 w-10 text-slate-200 mb-4" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sin actividad reciente</p>
                 </div>
               )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
