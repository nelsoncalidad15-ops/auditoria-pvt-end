import { useMemo } from "react";
import { LOCATIONS } from "../constants";
import { calculatePersonScores } from "../services/or-audit";
import { AuditSession, Location } from "../types";

const MONTHLY_AUDIT_TARGET = 2;
const LOCATION_MONTHLY_TARGET = 1;
const DASHBOARD_PALETTE = ["#2563eb", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9", "#22c55e", "#f97316"];

type MonthlyDashboardRow = {
  monthKey: string;
  label: string;
  totalAudits: number;
  totalScore: number;
  averageScore: number;
  approvedCount: number;
  criticalCount: number;
  complianceRate: number;
  completion: number;
  pendingTarget: number;
} & Record<Location, number>;

type RoleDashboardRow = {
  role: string;
  averageScore: number;
  evaluations: number;
  criticalCount: number;
  fill: string;
};

type StaffDashboardRow = {
  key: string;
  role: string;
  staffName: string;
  totalScore: number;
  count: number;
  latestDate: string;
  location: Location;
  averageScore: number;
  shortLabel: string;
};

const createEmptyMonthRow = (monthKey: string): MonthlyDashboardRow => ({
  monthKey,
  label: new Date(`${monthKey}-01T00:00:00`).toLocaleDateString("es-AR", { month: "short", year: "2-digit" }),
  totalAudits: 0,
  totalScore: 0,
  averageScore: 0,
  approvedCount: 0,
  criticalCount: 0,
  complianceRate: 0,
  completion: 0,
  pendingTarget: MONTHLY_AUDIT_TARGET,
  Salta: 0,
  Jujuy: 0,
});

export function useDashboardMetrics(history: AuditSession[]) {
  return useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const recentAudits = history.slice(0, 3);
    const monthlyAudits = history.filter((audit) => audit.date?.startsWith(currentMonth));
    const ordersHistory = history.filter((item) => item.entityType === "or");

    const advisorRanking = calculatePersonScores(ordersHistory, "asesor", "asesorServicio");
    const technicianRanking = calculatePersonScores(ordersHistory, "tecnico", "tecnico");
    const controllerRanking = calculatePersonScores(ordersHistory, "controller", "controller");
    const washerRanking = calculatePersonScores(ordersHistory, "lavador", "lavador");
    const sparePartsRanking = calculatePersonScores(ordersHistory, "repuestos", "repuestos");
    const rankingPanels = [
      { id: "asesor", label: "Asesores", data: advisorRanking },
      { id: "tecnico", label: "T?cnicos", data: technicianRanking },
      { id: "controller", label: "Controllers", data: controllerRanking },
      { id: "lavador", label: "Lavadores", data: washerRanking },
      { id: "repuestos", label: "Repuestos", data: sparePartsRanking },
    ];

    const monthlyDashboardData = Array.from(
      history.reduce((acc, audit) => {
        const monthKey = audit.date.slice(0, 7);
        const current = acc.get(monthKey) ?? createEmptyMonthRow(monthKey);

        current.totalAudits += 1;
        current.totalScore += audit.totalScore;
        current[audit.location] += 1;

        if (audit.totalScore >= 90) {
          current.approvedCount += 1;
        }

        if (audit.totalScore < 70) {
          current.criticalCount += 1;
        }

        acc.set(monthKey, current);
        return acc;
      }, new Map<string, MonthlyDashboardRow>())
    )
      .map(([_, metrics]) => ({
        ...metrics,
        averageScore: metrics.totalAudits > 0 ? Math.round(metrics.totalScore / metrics.totalAudits) : 0,
        complianceRate: metrics.totalAudits > 0 ? Math.round((metrics.approvedCount / metrics.totalAudits) * 100) : 0,
        completion: Math.min((metrics.totalAudits / MONTHLY_AUDIT_TARGET) * 100, 100),
        pendingTarget: Math.max(MONTHLY_AUDIT_TARGET - metrics.totalAudits, 0),
      }))
      .sort((left, right) => right.monthKey.localeCompare(left.monthKey));

    const recentMonthlyDashboardData = monthlyDashboardData.slice(0, 6).reverse();
    const currentMonthSessions = history.filter((item) => item.date.startsWith(currentMonth));
    const currentMonthDashboard = monthlyDashboardData.find((item) => item.monthKey === currentMonth) ?? createEmptyMonthRow(currentMonth);
    const monthlyCriticalAudits = monthlyAudits.filter((item) => item.totalScore < 70).length;
    const coveredLocationsThisMonth = LOCATIONS.filter((location) => currentMonthDashboard[location] > 0).length;
    const pendingLocationsThisMonth = LOCATIONS.filter((location) => currentMonthDashboard[location] < LOCATION_MONTHLY_TARGET);

    const currentMonthRoleData = Array.from(
      currentMonthSessions.reduce((acc, audit) => {
        const roleName = audit.role || audit.items[0]?.category || "General";
        const current = acc.get(roleName) ?? { role: roleName, totalScore: 0, count: 0, criticalCount: 0 };
        current.totalScore += audit.totalScore;
        current.count += 1;
        if (audit.totalScore < 70) {
          current.criticalCount += 1;
        }
        acc.set(roleName, current);
        return acc;
      }, new Map<string, { role: string; totalScore: number; count: number; criticalCount: number }>())
    )
      .map(([_, metrics], index): RoleDashboardRow => ({
        role: metrics.role,
        averageScore: Math.round(metrics.totalScore / metrics.count),
        evaluations: metrics.count,
        criticalCount: metrics.criticalCount,
        fill: DASHBOARD_PALETTE[index % DASHBOARD_PALETTE.length],
      }))
      .sort((left, right) => right.averageScore - left.averageScore);

    const currentMonthStaffData = Array.from(
      currentMonthSessions
        .filter((item) => item.staffName?.trim())
        .reduce((acc, audit) => {
          const roleName = audit.role || audit.items[0]?.category || "General";
          const staffName = audit.staffName?.trim() || "Sin asignar";
          const key = `${roleName}::${staffName}`;
          const current = acc.get(key) ?? {
            key,
            role: roleName,
            staffName,
            totalScore: 0,
            count: 0,
            latestDate: audit.date,
            location: audit.location,
          };

          current.totalScore += audit.totalScore;
          current.count += 1;
          if (audit.date.localeCompare(current.latestDate) > 0) {
            current.latestDate = audit.date;
            current.location = audit.location;
          }

          acc.set(key, current);
          return acc;
        }, new Map<string, { key: string; role: string; staffName: string; totalScore: number; count: number; latestDate: string; location: Location }>())
    )
      .map(([_, metrics]): StaffDashboardRow => ({
        ...metrics,
        averageScore: Math.round(metrics.totalScore / metrics.count),
        shortLabel: metrics.staffName.length > 18 ? `${metrics.staffName.slice(0, 18)}...` : metrics.staffName,
      }))
      .sort((left, right) => left.averageScore - right.averageScore);

    const currentMonthRoleDistributionData = currentMonthRoleData.map((item) => ({
      name: item.role,
      value: item.evaluations,
      fill: item.fill,
    }));
    const currentMonthUniqueRoles = new Set(currentMonthSessions.map((item) => item.role || item.items[0]?.category || "General")).size;
    const currentMonthUniqueStaff = new Set(currentMonthSessions.map((item) => item.staffName?.trim()).filter(Boolean)).size;
    const currentMonthLowestRole = currentMonthRoleData[currentMonthRoleData.length - 1] ?? null;
    const currentMonthLowestStaff = currentMonthStaffData[0] ?? null;
    const dashboardDateLabel = new Date().toLocaleDateString("es-AR", {
      weekday: "long",
      day: "2-digit",
      month: "short",
    });
    const dashboardAlerts = [
      {
        label: "Cobertura mensual",
        value: `${currentMonthDashboard.totalAudits} evaluaciones`,
        detail: `${coveredLocationsThisMonth}/${LOCATIONS.length} sedes con actividad. ${currentMonthDashboard.pendingTarget > 0 ? `Falta cobertura mensual en ${pendingLocationsThisMonth.join(" y ")}.` : "Salta y Jujuy ya tuvieron evaluaci?n este mes."}`,
        tone: coveredLocationsThisMonth === LOCATIONS.length ? "success" : currentMonthDashboard.totalAudits > 0 ? "warning" : "danger",
      },
      {
        label: "?rea a seguir",
        value: currentMonthLowestRole ? `${currentMonthLowestRole.role} ? ${currentMonthLowestRole.averageScore}%` : "Sin datos",
        detail: currentMonthLowestRole ? `${currentMonthLowestRole.evaluations} evaluaciones en el mes actual.` : "Todav?a no hay ?reas evaluadas este mes.",
        tone: currentMonthLowestRole ? currentMonthLowestRole.averageScore >= 90 ? "success" : currentMonthLowestRole.averageScore >= 70 ? "warning" : "danger" : "warning",
      },
      {
        label: "Colaborador a revisar",
        value: currentMonthLowestStaff ? `${currentMonthLowestStaff.staffName} ? ${currentMonthLowestStaff.averageScore}%` : "Sin datos",
        detail: currentMonthLowestStaff ? `${currentMonthLowestStaff.role} ? ${currentMonthLowestStaff.location} ? ${currentMonthLowestStaff.count} evaluaci?n(es).` : "Todav?a no hay colaboradores evaluados este mes.",
        tone: currentMonthLowestStaff ? currentMonthLowestStaff.averageScore >= 90 ? "success" : currentMonthLowestStaff.averageScore >= 70 ? "warning" : "danger" : "warning",
      },
      {
        label: "Promedio del mes",
        value: currentMonthDashboard.totalAudits > 0 ? `${currentMonthDashboard.averageScore}%` : "Sin datos",
        detail: currentMonthDashboard.totalAudits > 0 ? `${currentMonthDashboard.approvedCount} aprobadas y ${monthlyCriticalAudits} cr?ticas.` : "Todav?a no hay cierres registrados en el mes actual.",
        tone: currentMonthDashboard.averageScore >= 90 ? "success" : currentMonthDashboard.averageScore >= 70 ? "warning" : "danger",
      },
    ] as const;

    return {
      rankingPanels,
      monthlyDashboardData,
      recentMonthlyDashboardData,
      recentAudits,
      currentMonthDashboard,
      monthlyCriticalAudits,
      currentMonthRoleData,
      currentMonthStaffData,
      currentMonthRoleDistributionData,
      currentMonthUniqueRoles,
      currentMonthUniqueStaff,
      dashboardDateLabel,
      dashboardAlerts,
    };
  }, [history]);
}
