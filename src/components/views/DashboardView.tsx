import React from "react";
import { motion } from "motion/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AuditSession, Location } from "../../types";

type CityFilter = "all" | Location;
type MonthFilter = "all" | string;

const ROLE_COLORS = ["#1D4ED8", "#0F766E", "#0EA5E9", "#14B8A6", "#F59E0B", "#EA580C", "#7C3AED"];

interface DashboardViewProps {
  history: AuditSession[];
}

function toMonth(date: string) {
  return date.slice(5, 7);
}

function toYear(date: string) {
  return date.slice(0, 4);
}

function monthLabel(month: string) {
  const date = new Date(`2026-${month}-01T00:00:00`);
  return date.toLocaleDateString("es-AR", { month: "short" });
}

export function DashboardView({ history }: DashboardViewProps) {
  const sectionTransition = { duration: 0.38, ease: "easeOut" as const };
  const [activeFilterPulse, setActiveFilterPulse] = React.useState<"year" | "month" | "city" | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const refreshTimeoutRef = React.useRef<number | null>(null);

  const triggerRefreshFeedback = () => {
    setIsRefreshing(true);
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = window.setTimeout(() => {
      setIsRefreshing(false);
      refreshTimeoutRef.current = null;
    }, 320);
  };

  const triggerFilterPulse = (filterId: "year" | "month" | "city") => {
    setActiveFilterPulse(filterId);
    window.setTimeout(() => setActiveFilterPulse((current) => (current === filterId ? null : current)), 220);
  };

  React.useEffect(() => () => {
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
    }
  }, []);

  const yearOptions = React.useMemo(() => {
    const years = Array.from(new Set(history.map((item) => toYear(item.date))));
    return years.sort((a, b) => b.localeCompare(a));
  }, [history]);

  const monthOptions = React.useMemo(() => {
    const months = Array.from(new Set(history.map((item) => toMonth(item.date))));
    return months.sort((a, b) => a.localeCompare(b));
  }, [history]);

  const currentYear = new Date().toISOString().slice(0, 4);
  const currentMonth = new Date().toISOString().slice(5, 7);

  const [selectedYear, setSelectedYear] = React.useState<string>(
    yearOptions.includes(currentYear) ? currentYear : (yearOptions[0] || currentYear)
  );
  const [selectedMonth, setSelectedMonth] = React.useState<MonthFilter>(
    monthOptions.includes(currentMonth) ? currentMonth : "all"
  );
  const [selectedCity, setSelectedCity] = React.useState<CityFilter>("all");

  React.useEffect(() => {
    if (yearOptions.length > 0 && !yearOptions.includes(selectedYear)) {
      setSelectedYear(yearOptions[0]);
    }
  }, [selectedYear, yearOptions]);

  const filteredSessions = React.useMemo(() => {
    return history.filter((item) => {
      const itemYear = toYear(item.date);
      const itemMonth = toMonth(item.date);
      const byYear = itemYear === selectedYear;
      const byMonth = selectedMonth === "all" || itemMonth === selectedMonth;
      const byCity = selectedCity === "all" || item.location === selectedCity;
      return byYear && byMonth && byCity;
    });
  }, [history, selectedCity, selectedMonth, selectedYear]);

  const kpis = React.useMemo(() => {
    const total = filteredSessions.length;
    const average = total > 0 ? Math.round(filteredSessions.reduce((acc, item) => acc + item.totalScore, 0) / total) : 0;
    const approved = filteredSessions.filter((item) => item.totalScore >= 90).length;
    const critical = filteredSessions.filter((item) => item.totalScore < 70).length;
    return {
      total,
      average,
      approvedRate: total > 0 ? Math.round((approved / total) * 100) : 0,
      critical,
    };
  }, [filteredSessions]);

  const trendData = React.useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = String(i + 1).padStart(2, "0");
      const monthSessions = history.filter((item) => {
        const byYear = toYear(item.date) === selectedYear;
        const byMonth = toMonth(item.date) === month;
        const byCity = selectedCity === "all" || item.location === selectedCity;
        return byYear && byMonth && byCity;
      });

      const total = monthSessions.length;
      const avg = total > 0 ? Math.round(monthSessions.reduce((acc, item) => acc + item.totalScore, 0) / total) : 0;

      return {
        month: monthLabel(month),
        promedio: avg,
        auditorias: total,
      };
    });
  }, [history, selectedCity, selectedYear]);

  const cityData = React.useMemo(() => {
    const salta = filteredSessions.filter((item) => item.location === "Salta").length;
    const jujuy = filteredSessions.filter((item) => item.location === "Jujuy").length;
    return [
      { name: "Salta", value: salta, fill: "#0F766E" },
      { name: "Jujuy", value: jujuy, fill: "#1D4ED8" },
    ];
  }, [filteredSessions]);

  const roleData = React.useMemo(() => {
    const rows = Array.from(
      filteredSessions.reduce((acc, item) => {
        const roleName = item.role || item.items[0]?.category || "General";
        const current = acc.get(roleName) ?? { role: roleName, total: 0, score: 0 };
        current.total += 1;
        current.score += item.totalScore;
        acc.set(roleName, current);
        return acc;
      }, new Map<string, { role: string; total: number; score: number }>())
    );

    return rows
      .map(([_, row], index) => ({
        role: row.role,
        promedio: Math.round(row.score / row.total),
        total: row.total,
        fill: ROLE_COLORS[index % ROLE_COLORS.length],
      }))
      .sort((a, b) => b.promedio - a.promedio);
  }, [filteredSessions]);

  const scoreBands = React.useMemo(() => {
    const excellent = filteredSessions.filter((item) => item.totalScore >= 90).length;
    const medium = filteredSessions.filter((item) => item.totalScore >= 70 && item.totalScore < 90).length;
    const low = filteredSessions.filter((item) => item.totalScore < 70).length;
    return [
      { name: "Alta", value: excellent, fill: "#16A34A" },
      { name: "Media", value: medium, fill: "#D97706" },
      { name: "Baja", value: low, fill: "#DC2626" },
    ];
  }, [filteredSessions]);

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={sectionTransition}
        className="dashboard-shell rounded-[2rem] p-5 md:p-6"
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-blue-100/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">Dashboard ejecutivo</span>
          <span className="inline-flex items-center rounded-full bg-teal-100/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-teal-700">Visual corporativo Autosol</span>
          {isRefreshing && (
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-blue-700"
            >
              <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
              Actualizando m?tricas
            </motion.span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <motion.div
            animate={activeFilterPulse === "year" ? { scale: [1, 1.02, 1] } : { scale: 1 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                triggerFilterPulse("year");
                triggerRefreshFeedback();
              }}
              className="dashboard-filter"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>A?o {year}</option>
              ))}
            </select>
          </motion.div>

          <motion.div
            animate={activeFilterPulse === "month" ? { scale: [1, 1.02, 1] } : { scale: 1 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value as MonthFilter);
                triggerFilterPulse("month");
                triggerRefreshFeedback();
              }}
              className="dashboard-filter"
            >
              <option value="all">Mes: Todos</option>
              {monthOptions.map((month) => (
                <option key={month} value={month}>{monthLabel(month)}</option>
              ))}
            </select>
          </motion.div>

          <motion.div
            animate={activeFilterPulse === "city" ? { scale: [1, 1.02, 1] } : { scale: 1 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <select
              value={selectedCity}
              onChange={(e) => {
                setSelectedCity(e.target.value as CityFilter);
                triggerFilterPulse("city");
                triggerRefreshFeedback();
              }}
              className="dashboard-filter"
            >
              <option value="all">Ciudad: Todas</option>
              <option value="Salta">Salta</option>
              <option value="Jujuy">Jujuy</option>
            </select>
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...sectionTransition, delay: 0.05 }}
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        {[
          { label: "Auditor?as", value: String(kpis.total) },
          { label: "Promedio", value: kpis.total > 0 ? `${kpis.average}%` : "-" },
          { label: "Aprobaci?n", value: kpis.total > 0 ? `${kpis.approvedRate}%` : "-" },
          { label: "Cr?ticas", value: String(kpis.critical) },
        ].map((kpi, index) => (
          <motion.article
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut", delay: 0.08 + index * 0.04 }}
            className="dashboard-kpi"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{kpi.label}</p>
            {isRefreshing ? (
              <div className="dashboard-skeleton mt-2 h-9 w-20 rounded-xl" />
            ) : (
              <p className="mt-2 text-3xl font-black text-slate-900">{kpi.value}</p>
            )}
          </motion.article>
        ))}
      </motion.section>

      <motion.section
        key={`charts-top-${selectedYear}-${selectedMonth}-${selectedCity}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...sectionTransition, delay: 0.08 }}
        className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
      >
        <motion.article whileHover={{ y: -2 }} transition={{ duration: 0.18 }} className="dashboard-card">
          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Evoluci?n mensual</h3>
          <div className="mt-3 h-[280px] w-full">
            {isRefreshing ? (
              <div className="h-full w-full rounded-2xl border border-blue-100/80 bg-blue-50/35 p-4">
                <div className="dashboard-skeleton h-4 w-28 rounded-lg" />
                <div className="mt-5 space-y-3">
                  <div className="dashboard-skeleton h-10 w-full rounded-xl" />
                  <div className="dashboard-skeleton h-10 w-full rounded-xl" />
                  <div className="dashboard-skeleton h-10 w-[86%] rounded-xl" />
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="avgFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.34} />
                      <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#E2E8F0" vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 14, border: "1px solid #E2E8F0" }} />
                  <Area type="monotone" dataKey="promedio" stroke="#1D4ED8" strokeWidth={2.6} fill="url(#avgFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.article>

        <motion.article whileHover={{ y: -2 }} transition={{ duration: 0.18 }} className="dashboard-card">
          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Distribuci?n de puntajes</h3>
          <div className="mt-3 h-[280px] w-full">
            {isRefreshing ? (
              <div className="flex h-full items-center justify-center">
                <div className="dashboard-skeleton h-44 w-44 rounded-full" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={scoreBands} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={4}>
                    {scoreBands.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 14, border: "1px solid #E2E8F0" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.article>
      </motion.section>

      <motion.section
        key={`charts-bottom-${selectedYear}-${selectedMonth}-${selectedCity}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...sectionTransition, delay: 0.12 }}
        className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
      >
        <motion.article whileHover={{ y: -2 }} transition={{ duration: 0.18 }} className="dashboard-card">
          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Auditor?as por ciudad</h3>
          <div className="mt-3 h-[260px] w-full">
            {isRefreshing ? (
              <div className="h-full w-full rounded-2xl border border-blue-100/80 bg-blue-50/35 p-4">
                <div className="dashboard-skeleton h-36 w-full rounded-xl" />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="dashboard-skeleton h-7 rounded-lg" />
                  <div className="dashboard-skeleton h-7 rounded-lg" />
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cityData}>
                  <CartesianGrid stroke="#E2E8F0" vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 14, border: "1px solid #E2E8F0" }} />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                    {cityData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.article>

        <motion.article whileHover={{ y: -2 }} transition={{ duration: 0.18 }} className="dashboard-card">
          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Cumplimiento por ?rea</h3>
          <div className="mt-3 h-[260px] w-full">
            {isRefreshing ? (
              <div className="space-y-3">
                <div className="dashboard-skeleton h-9 w-full rounded-lg" />
                <div className="dashboard-skeleton h-9 w-[92%] rounded-lg" />
                <div className="dashboard-skeleton h-9 w-[84%] rounded-lg" />
                <div className="dashboard-skeleton h-9 w-[76%] rounded-lg" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roleData} layout="vertical" margin={{ left: 16, right: 8 }}>
                  <CartesianGrid stroke="#E2E8F0" horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 12 }} />
                  <YAxis dataKey="role" type="category" width={110} axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12, fontWeight: 700 }} />
                  <Tooltip contentStyle={{ borderRadius: 14, border: "1px solid #E2E8F0" }} />
                  <Bar dataKey="promedio" radius={[0, 10, 10, 0]}>
                    {roleData.map((entry) => (
                      <Cell key={entry.role} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.article>
      </motion.section>
    </div>
  );
}
