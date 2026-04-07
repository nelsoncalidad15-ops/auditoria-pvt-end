import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Droplets,
  FileCheck,
  FileText,
  Package,
  ShieldCheck,
  Truck,
  UserCheck,
  Wrench,
} from "lucide-react";

import { cn } from "../../lib/utils";
import { AuditCategory, Location } from "../../types";

type AuditEntryTab = "areas" | "scores";

interface CompletedAuditPreview {
  role: string;
  session: {
    totalScore: number;
  };
}

interface AdvisorScoreRow {
  personName: string;
  compliance: number;
  evaluations: number;
  areas: string[];
}

interface TechnicianScoreRow {
  personName: string;
  compliance: number;
  evaluations: number;
  ordersScore: number | null;
  technicianAuditScore: number | null;
}

interface AreaScoreRow {
  role: string;
  average: number | null;
  evaluations: number;
}

interface AuditLandingViewProps {
  auditBatchDisplayName?: string;
  selectedAuditorName?: string;
  selectedLocation?: Location;
  dateLabel?: string;
  auditEntryTab: AuditEntryTab;
  onChangeAuditEntryTab: (tab: AuditEntryTab) => void;
  auditCategories: AuditCategory[];
  completedAuditReports: CompletedAuditPreview[];
  sampledOrdersProgress: number;
  sampledServiceAdvisorClientsProgress: number;
  blendedServiceAdvisorScoreRows: AdvisorScoreRow[];
  blendedTechnicianScoreRows: TechnicianScoreRow[];
  areaScoreRows: AreaScoreRow[];
  onSelectCategory: (categoryName: string) => void;
  canGenerateReport: boolean;
  onGenerateReport: () => void;
}

function normalizeLabel(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function resolveCategoryIcon(categoryName: string) {
  const normalizedName = normalizeLabel(categoryName);

  if (normalizedName.includes("asesor")) return UserCheck;
  if (normalizedName.includes("tecnico")) return Wrench;
  if (normalizedName.includes("jefe")) return ShieldCheck;
  if (normalizedName.includes("lavadero")) return Droplets;
  if (normalizedName.includes("garantia")) return FileCheck;
  if (normalizedName.includes("repuesto")) return Package;
  if (normalizedName.includes("pre entrega")) return Truck;
  if (normalizedName.includes("orden")) return FileText;

  return ClipboardList;
}

function resolveCategoryTone(progress?: number) {
  if (typeof progress !== "number") return "is-idle";
  if (progress >= 90) return "is-strong";
  if (progress >= 75) return "is-medium";
  return "is-alert";
}

function resolveScoreTone(value: number | null) {
  if (typeof value !== "number") return "text-slate-400";
  if (value >= 90) return "text-emerald-600";
  if (value >= 75) return "text-amber-600";
  return "text-rose-600";
}

export function AuditLandingView({
  auditBatchDisplayName,
  selectedAuditorName,
  selectedLocation,
  dateLabel,
  auditEntryTab,
  onChangeAuditEntryTab,
  auditCategories,
  completedAuditReports,
  sampledOrdersProgress,
  sampledServiceAdvisorClientsProgress,
  blendedServiceAdvisorScoreRows,
  blendedTechnicianScoreRows,
  areaScoreRows,
  onSelectCategory,
  canGenerateReport,
  onGenerateReport,
}: AuditLandingViewProps) {
  const overviewCards = [
    {
      label: "Auditor",
      value: selectedAuditorName || "Sin definir",
    },
    {
      label: "Sucursal",
      value: selectedLocation || "Sin definir",
    },
    {
      label: "Fecha",
      value: dateLabel || "Sin definir",
    },
    {
      label: "Areas cerradas",
      value: `${completedAuditReports.length}/${auditCategories.length}`,
    },
  ];

  return (
    <div className="audit-entry-shell">
      <section className="audit-entry-hero">
        <div className="audit-entry-hero-copy">
          <div className="audit-entry-kicker">
            <span className="audit-entry-kicker-dot" />
            Auditoria
          </div>
          <div className="space-y-3">
            <h2 className="audit-entry-title">Selecciona un area.</h2>
            {auditBatchDisplayName && <p className="audit-entry-batch">{auditBatchDisplayName}</p>}
          </div>
        </div>

        <div className="audit-entry-hero-side">
          <div className="audit-entry-hero-stat">
            <p className="audit-entry-hero-label">Modo</p>
            <p className="audit-entry-hero-value">{auditEntryTab === "areas" ? "Operacion" : "Analitica"}</p>
          </div>
          <div className="audit-entry-hero-stat">
            <p className="audit-entry-hero-label">Cobertura</p>
            <p className="audit-entry-hero-value">{auditCategories.length}</p>
          </div>
        </div>
      </section>

      <section className="audit-entry-overview-grid">
        {overviewCards.map((card) => (
          <article key={card.label} className="audit-entry-overview-card">
            <p className="audit-entry-overview-label">{card.label}</p>
            <p className="audit-entry-overview-value">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="audit-entry-panel">
        <div className="audit-entry-panel-header">
          <div>
            <p className="audit-entry-section-kicker">Workspace</p>
            <h3 className="audit-entry-section-title">Entrada</h3>
          </div>
          <div className="audit-entry-tabs">
            <button
              type="button"
              onClick={() => onChangeAuditEntryTab("areas")}
              className={cn("audit-entry-tab", auditEntryTab === "areas" && "is-active")}
            >
              Areas
            </button>
            <button
              type="button"
              onClick={() => onChangeAuditEntryTab("scores")}
              className={cn("audit-entry-tab", auditEntryTab === "scores" && "is-active")}
            >
              Scores
            </button>
          </div>
        </div>

        {auditEntryTab === "areas" ? (
          <div className="audit-entry-grid">
            {auditCategories.map((category) => {
              const completedCategoryReport = completedAuditReports.find((report) => report.role === category.name);
              const normalizedName = normalizeLabel(category.name);
              const categoryProgress = normalizedName.includes("orden")
                ? sampledOrdersProgress
                : normalizedName.includes("asesores de servicio")
                  ? sampledServiceAdvisorClientsProgress
                  : completedCategoryReport?.session.totalScore;
              const Icon = resolveCategoryIcon(category.name);
              const toneClass = resolveCategoryTone(categoryProgress);

              return (
                <button
                  key={category.id}
                  onClick={() => onSelectCategory(category.name)}
                  className={cn("audit-entry-card", toneClass)}
                >
                  <div className="audit-entry-card-top">
                    <div className="audit-entry-icon-wrap">
                      <Icon className="h-5 w-5" />
                    </div>
                    {typeof categoryProgress === "number" ? (
                      <span className="audit-entry-progress-badge">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {categoryProgress}%
                      </span>
                    ) : (
                      <span className="audit-entry-progress-badge is-pending">Pendiente</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h4 className="audit-entry-card-title">{category.name}</h4>
                    {category.description?.trim() ? <p className="audit-entry-card-copy">{category.description.trim()}</p> : null}
                  </div>

                  <div className="audit-entry-card-footer">
                    <span className="audit-entry-card-meta">{category.items.length} items</span>
                    <span className="audit-entry-card-link">
                      Abrir
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="audit-entry-scores">
            <article className="audit-entry-score-card">
              <div className="audit-entry-score-header">
                <div>
                  <p className="audit-entry-score-kicker">Resumen</p>
                  <h4 className="audit-entry-score-title">Asesores de servicio</h4>
                </div>
                <span className="audit-entry-score-pill">{blendedServiceAdvisorScoreRows.length} personas</span>
              </div>
              <div className="audit-entry-table-wrap">
                <table className="audit-entry-table">
                  <thead>
                    <tr>
                      <th>Asesor</th>
                      <th>Areas</th>
                      <th className="text-center">Resultado</th>
                      <th className="text-center">Auditorias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blendedServiceAdvisorScoreRows.length > 0 ? (
                      blendedServiceAdvisorScoreRows.map((row) => (
                        <tr key={`advisor-score-${row.personName}`}>
                          <td>{row.personName}</td>
                          <td>{row.areas.join(" + ")}</td>
                          <td className={cn("text-center font-black", resolveScoreTone(row.compliance))}>{row.compliance}%</td>
                          <td className="text-center">{row.evaluations}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="audit-entry-empty-row">Sin datos.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="audit-entry-score-card">
              <div className="audit-entry-score-header">
                <div>
                  <p className="audit-entry-score-kicker">Resumen</p>
                  <h4 className="audit-entry-score-title">Tecnicos</h4>
                </div>
                <span className="audit-entry-score-pill">{blendedTechnicianScoreRows.length} personas</span>
              </div>
              <div className="audit-entry-table-wrap">
                <table className="audit-entry-table">
                  <thead>
                    <tr>
                      <th>Tecnico</th>
                      <th className="text-center">OR</th>
                      <th className="text-center">Aud. tecnicos</th>
                      <th className="text-center">Final</th>
                      <th className="text-center">Auditorias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blendedTechnicianScoreRows.length > 0 ? (
                      blendedTechnicianScoreRows.map((row) => (
                        <tr key={`technician-score-${row.personName}`}>
                          <td>{row.personName}</td>
                          <td className="text-center">{typeof row.ordersScore === "number" ? `${row.ordersScore}%` : "-"}</td>
                          <td className="text-center">{typeof row.technicianAuditScore === "number" ? `${row.technicianAuditScore}%` : "-"}</td>
                          <td className={cn("text-center font-black", resolveScoreTone(row.compliance))}>{row.compliance}%</td>
                          <td className="text-center">{row.evaluations}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="audit-entry-empty-row">Sin datos.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="audit-entry-score-card">
              <div className="audit-entry-score-header">
                <div>
                  <p className="audit-entry-score-kicker">Resumen</p>
                  <h4 className="audit-entry-score-title">Por area</h4>
                </div>
                <span className="audit-entry-score-pill">{areaScoreRows.length} areas</span>
              </div>
              <div className="audit-entry-table-wrap">
                <table className="audit-entry-table">
                  <thead>
                    <tr>
                      <th>Area</th>
                      <th className="text-center">Resultado</th>
                      <th className="text-center">Auditorias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {areaScoreRows.map((row) => (
                      <tr key={`area-score-${row.role}`}>
                        <td>{row.role}</td>
                        <td className={cn("text-center font-black", resolveScoreTone(row.average))}>
                          {typeof row.average === "number" ? `${row.average}%` : "-"}
                        </td>
                        <td className="text-center">{row.evaluations}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        )}

        {canGenerateReport && (
          <div className="audit-entry-actions">
            <button type="button" onClick={onGenerateReport} className="audit-entry-report-button">
              <BarChart3 className="h-4 w-4" />
              Reporte
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
