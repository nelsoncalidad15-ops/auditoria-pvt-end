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
import { AnimatedNumber } from "../common/AnimatedNumber";

interface DashboardViewProps {
  history: AuditSession[];
  onOpenHistory: () => void;
}

export const DashboardView = memo(({ history, onOpenHistory }: DashboardViewProps) => {
  const {
    selectedMonth,
    setSelectedMonth,
    selectedCity,
    setSelectedCity,
    cities,
    kpis,
    auditBreakdown,
    trendData,
    scoreBands,
    isRefreshing,
    topFailures,
  } = useDashboardMetrics(history);
  const approvalData = [
    { name: "Aprobadas", value: kpis.approved, fill: "#10b981" },
    { name: "Desaprobadas", value: kpis.rejected, fill: "#ef4444" },
  ].filter((item) => item.value > 0);
  const auditTypeData = [
    { name: "Integrales", value: auditBreakdown.general, fill: "#2563eb" },
    { name: "Específicas", value: auditBreakdown.specific, fill: "#8b5cf6" },
    { name: "Campañas OR", value: auditBreakdown.orderCampaigns, fill: "#14b8a6" },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-5 pb-8">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-[#eaf2fb] flex items-center justify-center text-[#165b91] border border-[#d9e7f2]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#001e50]">Dashboard <span className="font-normal text-[#34769a]">operativo</span></h1>
            <p className="text-slate-500 font-semibold text-[9px] uppercase tracking-[0.18em] mt-1 flex items-center gap-2">
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
            <option value="Todos">Todos los meses</option>
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
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {[
          { label: "Auditorías", value: kpis.total, suffix: "", enabled: true, sub: "Conjuntos cerrados", icon: ClipboardCheck, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Promedio", value: kpis.average, suffix: "%", enabled: true, sub: "Nivel de Calidad", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Aprobación", value: kpis.approvedRate, suffix: "%", enabled: history.length > 0, sub: "Tasa de Éxito", icon: Activity, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Críticas", value: kpis.critical, suffix: "", enabled: true, sub: "Fallas Graves", icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onPointerMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              event.currentTarget.style.setProperty("--spotlight-x", `${event.clientX - bounds.left}px`);
              event.currentTarget.style.setProperty("--spotlight-y", `${event.clientY - bounds.top}px`);
            }}
            whileHover={{ y: -3, scale: 1.01 }}
            className="spotlight-card premium-card group relative overflow-hidden border-[#e0e8f0] bg-white p-4 transition-all hover:border-[#9ebfd5]"
          >
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
              <kpi.icon className="h-24 w-24" />
            </div>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center border", kpi.bg, kpi.color, "border-slate-100")}>
                <kpi.icon className="h-5 w-5" />
              </div>
              <p className="text-[8px] font-bold uppercase tracking-[0.15em] text-slate-400">{kpi.sub}</p>
            </div>
            <div className="space-y-1 relative z-10">
              <h3 className="text-2xl font-bold tracking-tight text-[#001e50] leading-none"><AnimatedNumber value={kpi.value} suffix={kpi.suffix} enabled={kpi.enabled} fallback="—" /></h3>
              <p className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.12em]">{kpi.label}</p>
            </div>
          </motion.div>
        ))}
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-4"
      >
        {[
          { label: "Integrales", value: auditBreakdown.general, detail: "auditorías generales", tone: "bg-blue-50 text-blue-700" },
          { label: "Específicas", value: auditBreakdown.specific, detail: "auditorías por área", tone: "bg-violet-50 text-violet-700" },
          { label: "Campañas OR", value: auditBreakdown.orderCampaigns, detail: "conjuntos de órdenes", tone: "bg-emerald-50 text-emerald-700" },
          { label: "Órdenes revisadas", value: auditBreakdown.orderUnits, detail: "OR dentro de campañas", tone: "bg-amber-50 text-amber-700" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <span className={cn("flex h-9 min-w-9 items-center justify-center rounded-xl text-sm font-black", item.tone)}>{item.value}</span>
            <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-wider text-slate-700">{item.label}</p><p className="truncate text-[9px] font-medium text-slate-400">{item.detail}</p></div>
          </div>
        ))}
      </motion.section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr,1fr]">
        <motion.article 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="premium-card p-5 bg-white h-[390px] flex flex-col"
        >
          <div className="mb-5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-slate-400 mb-2">Desempeño Mensual</h3>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-tight uppercase italic text-slate-900 dark:text-white">Tendencia Consolidada</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-600" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Salta</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-teal-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Jujuy</span>
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
                    tick={{ fill: "#475569", fontSize: 10, fontWeight: 900 }} 
                    dy={10}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "#475569", fontSize: 10, fontWeight: 900 }}
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
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-slate-400 mb-2">Composición del Score</h3>
            <h2 className="text-2xl font-black tracking-tight uppercase italic leading-none text-slate-900 dark:text-white">Distribución Grupal</h2>
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
                 <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">{band.name}</span>
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
          className="premium-card flex flex-col bg-white p-6 dark:bg-white/5"
        >
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Lectura operativa</p>
            <h3 className="mt-1 text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Estado y tipo de auditorías</h3>
          </div>
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { title: "Resultado", data: approvalData, center: `${kpis.approved}/${kpis.total}` },
              { title: "Composición", data: auditTypeData, center: String(kpis.total) },
            ].map((chart) => (
              <div key={chart.title} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                <p className="text-center text-[9px] font-black uppercase tracking-wider text-slate-500">{chart.title}</p>
                <div className="relative h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={chart.data} dataKey="value" innerRadius={42} outerRadius={58} paddingAngle={5} stroke="none">{chart.data.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}</Pie><Tooltip /></PieChart>
                  </ResponsiveContainer>
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg font-black text-slate-900">{chart.center}</span>
                </div>
                <div className="space-y-1.5">{chart.data.map((entry) => <div key={entry.name} className="flex items-center justify-between text-[9px] font-bold"><span className="flex items-center gap-1.5 text-slate-500"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.fill }} />{entry.name}</span><b className="text-slate-800">{entry.value}</b></div>)}</div>
              </div>
            ))}
          </div>
          <button onClick={onOpenHistory} className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white transition active:scale-[0.98]">Ver detalle en el registro</button>
        </motion.article>
      </div>
    </div>
  );
});
