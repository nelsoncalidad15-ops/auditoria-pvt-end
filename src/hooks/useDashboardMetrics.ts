import { useMemo, useState } from "react";
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

export function useDashboardMetrics(history: AuditSession[] = []) {
  const [selectedMonth, setSelectedMonth] = useState("Todos");
  const [selectedCity, setSelectedCity] = useState("Todas");

  return useMemo(() => {
    // Records without a final numeric score are incomplete and do not belong in KPIs.
    const safeHistory = (Array.isArray(history) ? history : []).filter((audit) => (
      typeof audit?.totalScore === "number" && Number.isFinite(audit.totalScore)
    ));
    const filteredHistory = safeHistory.filter((audit) => (
      (selectedMonth === "Todos" || audit.date?.slice(5, 7) === selectedMonth)
      && (selectedCity === "Todas" || audit.location === selectedCity)
    ));

    const currentMonth = new Date().toISOString().slice(0, 7);
    const scoreScope = selectedMonth === "Todos" ? filteredHistory.filter((audit) => audit.date?.startsWith(currentMonth)) : filteredHistory;
    const monthlyAudits = scoreScope;
    
    // Top 5 Failures
    const topFailures: TopFailure[] = Array.from(
      filteredHistory.flatMap(audit => audit?.items || [])
        .filter(item => item?.status === "fail")
        .reduce((acc, item) => {
          if (item?.question) {
            const count = acc.get(item.question) ?? 0;
            acc.set(item.question, count + 1);
          }
          return acc;
        }, new Map<string, number>())
    )
      .map(([question, count]) => ({ question, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Monthly Trend Data with City Comparison
    const monthlyDataMap = filteredHistory.reduce((acc, audit) => {
      if (!audit?.date) return acc;
      
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
      .map(m => {
        const dateObj = new Date(`${m.month}-01T00:00:00`);
        const monthLabel = isNaN(dateObj.getTime()) 
          ? m.month 
          : dateObj.toLocaleDateString("es-AR", { month: "short" });
          
        return {
          month: monthLabel,
          promedio: m.total > 0 ? Math.round(m.sum / m.total) : 0,
          saltaAvg: m.saltaCount > 0 ? Math.round(m.saltaSum / m.saltaCount) : 0,
          jujuyAvg: m.jujuyCount > 0 ? Math.round(m.jujuySum / m.jujuyCount) : 0,
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);

    const roleData = Array.from(
      monthlyAudits.reduce((acc, audit) => {
        const role = audit?.role || "General";
        const curr = acc.get(role) ?? { role, total: 0, count: 0 };
        curr.total += audit.totalScore;
        curr.count += 1;
        acc.set(role, curr);
        return acc;
      }, new Map<string, any>())
    ).map(([_, m], i) => ({
      role: m.role,
      promedio: m.count > 0 ? Math.round(m.total / m.count) : 0,
      fill: DASHBOARD_PALETTE[i % DASHBOARD_PALETTE.length]
    })).sort((a, b) => b.promedio - a.promedio);

    const kpis = {
      total: filteredHistory.length,
      average: filteredHistory.length > 0 ? Math.round(filteredHistory.reduce((sum, audit) => sum + audit.totalScore, 0) / filteredHistory.length) : 0,
      approvedRate: filteredHistory.length > 0 ? Math.round((filteredHistory.filter((audit) => audit.totalScore >= 90).length / filteredHistory.length) * 100) : 0,
      critical: filteredHistory.filter((audit) => audit.totalScore < 70).length,
    };

    // Calculate score bands for pie chart
    const scoreBands: ScoreBand[] = [
      { name: "Excelente (90-100)", value: safeHistory.filter(a => (a?.totalScore || 0) >= 90).length, fill: "#10b981" },
      { name: "Bueno (75-89)", value: safeHistory.filter(a => (a?.totalScore || 0) >= 75 && (a?.totalScore || 0) < 90).length, fill: "#3b82f6" },
      { name: "Regular (60-74)", value: safeHistory.filter(a => (a?.totalScore || 0) >= 60 && (a?.totalScore || 0) < 75).length, fill: "#f59e0b" },
      { name: "Crítico (<60)", value: safeHistory.filter(a => (a?.totalScore || 0) < 60).length, fill: "#ef4444" },
    ].filter(b => b.value > 0);

    return {
      kpis,
      trendData,
      roleData,
      topFailures,
      scoreBands,
      isRefreshing: false,
      cities: [...LOCATIONS, "Todas"],
      selectedMonth,
      selectedCity,
      setSelectedMonth,
      setSelectedCity,
    };
  }, [history, selectedCity, selectedMonth]);
}
