import React, { memo } from "react";
import { 
  BarChart, 
  Bar, 
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
import { motion } from "motion/react";
import { useDashboardMetrics } from "../../hooks/useDashboardMetrics";
import { MONTHS } from "../../constants";
import { cn } from "../../lib/utils";

export const DashboardView = memo(() => {
  const {
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    selectedCity,
    setSelectedCity,
    years,
    cities,
    kpis,
    trendData,
    scoreBands,
    cityData,
    roleData,
    isRefreshing,
  } = useDashboardMetrics();

  return (
    <div className="space-y-8 pb-12">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Dashboard de Calidad</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-xs uppercase tracking-widest mt-0.5">Análisis de rendimiento</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="h-11 px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-[11px] uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer shadow-sm"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-11 px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-[11px] uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer shadow-sm"
          >
            {MONTHS.map((m, idx) => (
              <option key={m} value={String(idx + 1).padStart(2, "0")}>{m}</option>
            ))}
          </select>

          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="h-11 px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-[11px] uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer shadow-sm"
          >
            {cities.map((city) => (
              <option key={city} value={city}>
                {city === "all" ? "Todas las sucursales" : city}
              </option>
            ))}
          </select>
        </div>
      </motion.section>

      <motion.section
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          { label: "Auditorías", value: String(kpis.total), sub: "registros" },
          { label: "Promedio", value: `${kpis.average}%`, sub: "cumplimiento" },
          { label: "Aprobación", value: kpis.total > 0 ? `${kpis.approvedRate}%` : "-", sub: "tasa éxito" },
          { label: "Críticas", value: String(kpis.critical), sub: "desvíos" },
        ].map((kpi, index) => (
          <motion.article
            key={kpi.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="premium-card p-6 bg-white dark:bg-slate-900 flex flex-col justify-between"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{kpi.label}</p>
              {isRefreshing ? (
                <div className="h-9 w-20 bg-slate-100 dark:bg-slate-800 animate-pulse mt-2 rounded-lg" />
              ) : (
                <p className="text-3xl font-black mt-2 leading-none tracking-tight">{kpi.value}</p>
              )}
            </div>
            <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-widest">{kpi.sub}</p>
          </motion.article>
        ))}
      </motion.section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr,1fr]">
        <motion.article 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="premium-card p-6 bg-white dark:bg-slate-900 h-[400px] flex flex-col"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Evolución del Desempeño</h3>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-600" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cumplimiento %</span>
            </div>
          </div>
          <div className="flex-1 w-full min-h-0">
            {isRefreshing ? (
               <div className="h-full w-full bg-slate-50 dark:bg-slate-800/50 animate-pulse rounded-2xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
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
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '12px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="promedio" 
                    stroke="#2563eb" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorAvg)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.article>

        <motion.article 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="premium-card p-6 bg-white dark:bg-slate-900 h-[400px] flex flex-col"
        >
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 text-center">Distribución de Resultados</h3>
          <div className="flex-1 w-full min-h-0">
            {isRefreshing ? (
               <div className="h-full w-full flex items-center justify-center">
                 <div className="h-40 w-40 rounded-full border-8 border-slate-100 dark:border-slate-800 animate-spin border-t-blue-600" />
               </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={scoreBands}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {scoreBands.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} cornerRadius={8} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
             {scoreBands.map((band) => (
               <div key={band.name} className="flex items-center gap-2">
                 <div className="h-2 w-2 rounded-full" style={{ backgroundColor: band.fill }} />
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{band.name}</span>
               </div>
             ))}
          </div>
        </motion.article>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,1.5fr]">
         <motion.article 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="premium-card p-6 bg-white dark:bg-slate-900 h-[350px] flex flex-col"
        >
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Desempeño por Ciudad</h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {cityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.article>

        <motion.article 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="premium-card p-6 bg-white dark:bg-slate-900 h-[350px] flex flex-col"
        >
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Cumplimiento por Área Crítica</h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roleData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" opacity={0.5} />
                <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }} />
                <YAxis 
                  dataKey="role" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#64748b", fontSize: 10, fontWeight: 800 }}
                  width={100}
                />
                <Tooltip />
                <Bar dataKey="promedio" radius={[0, 6, 6, 0]}>
                  {roleData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.article>
      </div>
    </div>
  );
});
