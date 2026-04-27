import { memo } from "react";
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area
} from "recharts";
import { AlertCircle, TrendingUp, ClipboardCheck, Activity } from "lucide-react";
import { motion } from "motion/react";
import { useDashboardMetrics } from "../../hooks/useDashboardMetrics";
import { MONTHS } from "../../constants";
import { cn } from "../../lib/utils";
import { Skeleton } from "../common/Skeleton";
import { AuditSession } from "../../types";

interface DashboardViewProps {
  history: AuditSession[];
}

export const DashboardView = memo(({ history }: DashboardViewProps) => {
  const {
    selectedMonth,
    setSelectedMonth,
    selectedCity,
    setSelectedCity,
    cities,
    kpis,
    trendData,
    scoreBands,
    roleData,
    isRefreshing,
    topFailures,
  } = useDashboardMetrics(history);

  return (
    <div className="space-y-8 pb-12">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        <div className="flex items-center gap-5">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-2xl shadow-blue-500/30 border border-white/10">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">Dashboard <span className="text-blue-500">Operativo</span></h1>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em] mt-1 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Análisis de rendimiento en tiempo real
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-11 px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-[11px] uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer shadow-sm"
          >
            {MONTHS.map((m: string, idx: number) => (
              <option key={m} value={String(idx + 1).padStart(2, "0")}>{m}</option>
            ))}
          </select>

          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="h-11 px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-[11px] uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer shadow-sm"
          >
            {cities.map((city: string) => (
              <option key={city} value={city}>
                {city === "Todas" ? "Todas las sucursales" : city}
              </option>
            ))}
          </select>
        </div>
      </motion.section>

      <motion.section
        className="grid grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {[
          { label: "Auditorías", value: String(kpis.total), sub: "Volumen Total", icon: ClipboardCheck, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Promedio", value: `${kpis.average}%`, sub: "Nivel de Calidad", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Aprobación", value: history.length > 0 ? `${kpis.approvedRate}%` : "-", sub: "Tasa de Éxito", icon: Activity, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Críticas", value: String(kpis.critical), sub: "Fallas Graves", icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="premium-card p-6 bg-slate-900/50 border-white/5 hover:border-blue-500/30 transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
              <kpi.icon className="h-24 w-24" />
            </div>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center border shadow-lg", kpi.bg, kpi.color, "border-white/10")}>
                <kpi.icon className="h-5 w-5" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{kpi.sub}</p>
            </div>
            <div className="space-y-1 relative z-10">
              <h3 className="text-3xl font-black tracking-tighter text-white leading-none">{kpi.value}</h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em]">{kpi.label}</p>
            </div>
          </motion.div>
        ))}
      </motion.section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr,1fr]">
        <motion.article 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="premium-card p-8 bg-white dark:bg-slate-900 h-[450px] flex flex-col"
        >
          <div className="mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Desempeño Mensual</h3>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-tight uppercase italic italic">Tendencia Consolidada</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-600" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Salta</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-teal-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Jujuy</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 w-full min-h-0">
            {isRefreshing ? (
              <Skeleton className="h-full w-full rounded-2xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorSalta" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorJujuy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }} 
                    dy={10}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '24px', 
                      border: 'none', 
                      boxShadow: '0 25px 50px rgba(0,0,0,0.2)', 
                      padding: '16px',
                      background: 'rgba(15, 23, 42, 0.95)',
                      backdropFilter: 'blur(10px)',
                      color: '#fff'
                    }}
                  />
                  <Area 
                    name="Salta"
                    type="monotone" 
                    dataKey="saltaAvg" 
                    stroke="#2563eb" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorSalta)" 
                  />
                  <Area 
                    name="Jujuy"
                    type="monotone" 
                    dataKey="jujuyAvg" 
                    stroke="#14b8a6" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorJujuy)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.article>

        <motion.article 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="premium-card p-8 bg-white dark:bg-slate-900 h-[450px] flex flex-col"
        >
          <div className="mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Composición del Score</h3>
            <h2 className="text-2xl font-black tracking-tight uppercase italic leading-none">Distribución Grupal</h2>
          </div>
          <div className="flex-1 w-full flex items-center justify-center min-h-0">
            {isRefreshing ? (
              <Skeleton className="h-48 w-48 rounded-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={scoreBands}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {scoreBands.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
             {scoreBands.map((band: any) => (
               <div key={band.name} className="flex items-center gap-2">
                 <div className="h-2 w-2 rounded-full" style={{ backgroundColor: band.fill }} />
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{band.name}</span>
               </div>
             ))}
          </div>
        </motion.article>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.article 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="premium-card p-8 bg-slate-950 text-white flex flex-col relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <AlertCircle className="w-40 h-40" />
          </div>
          <div className="relative z-10 space-y-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-2">Análisis de Desvíos</p>
              <h3 className="text-2xl font-black italic uppercase leading-none tracking-tight">Top 5 Críticos</h3>
              <p className="text-slate-400 text-xs font-medium mt-2">Puntos de mayor recurrencia de falla que requieren refuerzo de capacitación.</p>
            </div>

            <div className="space-y-3">
              {topFailures.length > 0 ? topFailures.map((item, index) => (
                <div key={index} className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 group hover:bg-white/10 transition-colors">
                  <div className="h-10 w-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center font-black text-sm shrink-0 border border-red-500/20 group-hover:scale-110 transition-transform">
                    {item.count}
                  </div>
                  <p className="text-xs font-bold leading-tight text-slate-200">{item.question}</p>
                </div>
              )) : (
                <div className="py-12 text-center">
                  <p className="text-sm font-bold text-slate-500 italic">No se detectaron desvíos recurrentes en el período.</p>
                </div>
              )}
            </div>
          </div>
        </motion.article>

        <motion.article 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="premium-card p-8 bg-white dark:bg-white/5 flex flex-col justify-between"
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Recomendación Estratégica</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase leading-none tracking-tight italic">Plan de Acción</h3>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800">
                <div className="h-6 w-6 rounded-lg bg-blue-500 text-white flex items-center justify-center shrink-0 text-[10px] font-black">01</div>
                <p className="text-xs font-medium text-blue-900 dark:text-blue-300">Reforzar los puntos del Top 5 en la próxima reunión de equipo.</p>
              </div>
              <div className="flex gap-4 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800">
                <div className="h-6 w-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 text-[10px] font-black">02</div>
                <p className="text-xs font-medium text-emerald-900 dark:text-emerald-300">Felicitaciones al área con mayor cumplimiento: <b>{roleData[0]?.role || "-"}</b>.</p>
              </div>
              <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <div className="h-6 w-6 rounded-lg bg-slate-400 text-white flex items-center justify-center shrink-0 text-[10px] font-black">03</div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Verificar que todos los desvíos críticos tengan comentarios técnicos.</p>
              </div>
            </div>

            <button className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black text-[10px] uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all">
              Exportar Reporte Ejecutivo
            </button>
          </div>
        </motion.article>
      </div>
    </div>
  );
});
