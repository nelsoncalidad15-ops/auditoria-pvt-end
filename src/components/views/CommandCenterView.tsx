import { 
  Activity, 
  ArrowRight, 
  BarChart3, 
  ClipboardCheck, 
  Clock, 
  History as HistoryIcon, 
  Plus, 
  Settings2, 
  TrendingUp, 
  Users 
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";
import { AuditSession } from "../../types";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from "recharts";

interface CommandCenterViewProps {
  history: AuditSession[];
  localAuditHistoryCount: number;
  onStartAudit: () => void;
  onOpenHistory: () => void;
  onOpenSetup: () => void;
  onOpenContinue: () => void;
  onOpenStructure: () => void;
  canOpenStructure: boolean;
  canOpenContinue: boolean;
}

export function CommandCenterView({
  history,
  localAuditHistoryCount,
  onStartAudit,
  onOpenHistory,
  onOpenSetup,
  onOpenContinue,
  onOpenStructure,
  canOpenStructure,
  canOpenContinue,
}: CommandCenterViewProps) {
  // Mock trend data or derive from history
  const trendData = history.slice(-7).map((s, i) => ({
    name: s.date,
    score: s.totalScore
  }));

  const stats = [
    { label: "Cumplimiento Promedio", value: `${Math.round(history.reduce((acc, s) => acc + s.totalScore, 0) / (history.length || 1))}%`, icon: TrendingUp, color: "text-blue-600" },
    { label: "Auditorías Realizadas", value: history.length, icon: ClipboardCheck, color: "text-emerald-600" },
    { label: "Pendientes de Envío", value: localAuditHistoryCount, icon: Clock, color: "text-amber-600" },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between px-2">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Centro de Comando</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Gestiona y monitorea la calidad en tiempo real.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onStartAudit}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Plus className="h-5 w-5" />
            Nueva Auditoría
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="premium-card p-6 bg-white dark:bg-slate-900"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{stat.label}</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{stat.value}</p>
              </div>
              <div className={cn("p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800", stat.color)}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Main Chart */}
        <div className="premium-card p-6 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black">Tendencia de Calidad</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Últimas 7 auditorías</p>
            </div>
            <BarChart3 className="h-5 w-5 text-slate-300" />
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" hide />
                <YAxis hide domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                  labelStyle={{ fontWeight: '800' }}
                />
                <Area type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Continuar", desc: "Retomar borrador", icon: Clock, onClick: onOpenContinue, disabled: !canOpenContinue, color: "bg-amber-500" },
            { label: "Historial", desc: "Ver registros", icon: HistoryIcon, onClick: onOpenHistory, disabled: false, color: "bg-slate-800" },
            { label: "Estructura", desc: "Editar checklist", icon: Settings2, onClick: onOpenStructure, disabled: !canOpenStructure, color: "bg-blue-600" },
            { label: "Configurar", desc: "Auditor y sede", icon: Users, onClick: onOpenSetup, disabled: false, color: "bg-emerald-600" },
          ].map((action, i) => (
            <button
              key={action.label}
              onClick={action.onClick}
              disabled={action.disabled}
              className={cn(
                "premium-card p-5 text-left group flex flex-col justify-between transition-all active:scale-95 bg-white dark:bg-slate-900",
                action.disabled && "opacity-50 grayscale cursor-not-allowed"
              )}
            >
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg", action.color)}>
                <action.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">{action.label}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{action.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Activity List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-lg font-black">Actividad Reciente</h3>
          <button onClick={onOpenHistory} className="text-xs font-black uppercase tracking-widest text-blue-600 hover:text-blue-700">Ver todo</button>
        </div>
        <div className="space-y-3">
          {history.slice(0, 5).map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={onOpenHistory}
              className="premium-card p-4 flex items-center justify-between bg-white dark:bg-slate-900 group cursor-pointer hover:border-slate-300 dark:hover:border-slate-700"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center text-sm font-black",
                  item.totalScore >= 90 ? "bg-emerald-50 text-emerald-600" : item.totalScore >= 75 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                )}>
                  {item.totalScore}%
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{item.location}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{item.date} • {item.items.length} puntos</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-all transform group-hover:translate-x-1" />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
