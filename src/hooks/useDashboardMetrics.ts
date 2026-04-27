import { useMemo } from "react";
import { LOCATIONS } from "../constants";
import { AuditSession } from "../types";

const DASHBOARD_PALETTE = ["#2563eb", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9", "#22c55e", "#f97316"];

interface ScoreBand {
  name: string;
  value: number;
  fill: string;
}

interface TrendData {
  month: string;
  promedio: number;
  saltaAvg: number;
  jujuyAvg: number;
}

interface TopFailure {
  question: string;
  count: number;
}

export function useDashboardMetrics(history: AuditSession[]) {
  return useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyAudits = history.filter((audit) => audit.date?.startsWith(currentMonth));
    
    // Top 5 Failures
    const topFailures: TopFailure[] = Array.from(
      history.flatMap(audit => audit.items)
        .filter(item => item.status === "fail")
        .reduce((acc, item) => {
          const count = acc.get(item.question) ?? 0;
          acc.set(item.question, count + 1);
          return acc;
        }, new Map<string, number>())
    )
      .map(([question, count]) => ({ question, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Monthly Trend Data with City Comparison
    const monthlyDataMap = history.reduce((acc, audit) => {
      const monthKey = audit.date.slice(0, 7);
      if (!acc.has(monthKey)) {
        acc.set(monthKey, { month: monthKey, total: 0, sum: 0, saltaSum: 0, saltaCount: 0, jujuySum: 0, jujuyCount: 0 });
      }
      const m = acc.get(monthKey)!;
      m.total += 1;
      m.sum += audit.totalScore;
      if (audit.location === "Salta") {
        m.saltaSum += audit.totalScore;
        m.saltaCount += 1;
      } else if (audit.location === "Jujuy") {
        m.jujuySum += audit.totalScore;
        m.jujuyCount += 1;
      }
      return acc;
    }, new Map<string, any>());

    const trendData: TrendData[] = Array.from(monthlyDataMap.values())
      .map(m => ({
        month: new Date(`${m.month}-01T00:00:00`).toLocaleDateString("es-AR", { month: "short" }),
        promedio: Math.round(m.sum / m.total),
        saltaAvg: m.saltaCount > 0 ? Math.round(m.saltaSum / m.saltaCount) : 0,
        jujuyAvg: m.jujuyCount > 0 ? Math.round(m.jujuySum / m.jujuyCount) : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);

    const roleData = Array.from(
      monthlyAudits.reduce((acc, audit) => {
        const role = audit.role || "General";
        const curr = acc.get(role) ?? { role, total: 0, count: 0 };
        curr.total += audit.totalScore;
        curr.count += 1;
        acc.set(role, curr);
        return acc;
      }, new Map<string, any>())
    ).map(([_, m], i) => ({
      role: m.role,
      promedio: Math.round(m.total / m.count),
      fill: DASHBOARD_PALETTE[i % DASHBOARD_PALETTE.length]
    })).sort((a, b) => b.promedio - a.promedio);

    const kpis = {
      total: history.length,
      average: history.length > 0 ? Math.round(history.reduce((s, a) => s + a.totalScore, 0) / history.length) : 0,
      approvedRate: history.length > 0 ? Math.round((history.filter(a => a.totalScore >= 90).length / history.length) * 100) : 0,
      critical: history.filter(a => a.totalScore < 70).length,
    };

    // Calculate score bands for pie chart
    const scoreBands: ScoreBand[] = [
      { name: "Excelente (90-100)", value: history.filter(a => a.totalScore >= 90).length, fill: "#10b981" },
      { name: "Bueno (75-89)", value: history.filter(a => a.totalScore >= 75 && a.totalScore < 90).length, fill: "#3b82f6" },
      { name: "Regular (60-74)", value: history.filter(a => a.totalScore >= 60 && a.totalScore < 75).length, fill: "#f59e0b" },
      { name: "Crítico (<60)", value: history.filter(a => a.totalScore < 60).length, fill: "#ef4444" },
    ].filter(b => b.value > 0);

    return {
      kpis,
      trendData,
      roleData,
      topFailures,
      scoreBands,
      isRefreshing: false,
      cities: [...LOCATIONS, "Todas"],
      selectedMonth: "Todos",
      selectedCity: "Todas",
      setSelectedMonth: (_val: string) => {},
      setSelectedCity: (_val: string) => {},
    };
  }, [history]);
}
