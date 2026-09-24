import { useState, useRef } from "react";
import { Printer, ArrowLeft, Filter, Edit3, Save } from "lucide-react";
import { cn } from "../../lib/utils";
import type { AuditCategory, CompletedAuditReport, AuditTemplateItem, AuditSession } from "../../types";

interface SectionScore {
  sectionName: string;
  passCount: number;
  failCount: number;
  naCount: number;
  pendingCount: number;
  score: number;
}

interface FullReportViewProps {
  appTitle: string;
  completedReports: CompletedAuditReport[];
  auditCategories: AuditCategory[];
  overallScore: number;
  getSectionScores: (templateItems: AuditTemplateItem[], session: AuditSession) => SectionScore[];
  onClose: () => void;
}

export function FullReportView({
  appTitle,
  completedReports,
  auditCategories,
  overallScore,
  getSectionScores,
  onClose,
}: FullReportViewProps) {
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [isEditing, setIsEditing] = useState(false);
  const [editableTitle, setEditableTitle] = useState("Porcentaje de Cumplimiento");
  const [editableSubtitle, setEditableSubtitle] = useState("Proceso de Postventas");
  const [editableMonth, setEditableMonth] = useState(() => {
    const now = new Date();
    return now.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  });
  const [editableCompany, setEditableCompany] = useState("Autosol");
  const [notes, setNotes] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);

  // Build area names from categories
  const areaNames = auditCategories.map(c => c.name);

  // Filter reports by selected area
  const visibleReports = selectedArea === "all"
    ? completedReports
    : completedReports.filter(r => r.role === selectedArea);

  // Build the summary table rows (one per area/puesto)
  const summaryRows = areaNames.map(areaName => {
    const areaReports = completedReports.filter(r => r.role === areaName);
    const totalScore = areaReports.length > 0
      ? Math.round(areaReports.reduce((acc, r) => acc + (r.session.totalScore || 0), 0) / areaReports.length)
      : 0;
    return {
      area: areaName,
      score: totalScore,
      count: areaReports.length,
      reports: areaReports,
    };
  });

  // Build person-level breakdown per area
  const personBreakdowns = areaNames.map(areaName => {
    const areaReports = completedReports.filter(r => r.role === areaName);
    const byPerson = new Map<string, { scores: number[]; count: number }>();
    
    areaReports.forEach(r => {
      const name = r.session.staffName || "Sin asignar";
      const current = byPerson.get(name) || { scores: [], count: 0 };
      current.scores.push(r.session.totalScore || 0);
      current.count += 1;
      byPerson.set(name, current);
    });

    return {
      area: areaName,
      persons: Array.from(byPerson.entries()).map(([name, data]) => ({
        name,
        average: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
        count: data.count,
      })),
    };
  }).filter(b => b.persons.length > 0);

  const handlePrint = () => {
    window.print();
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-700 bg-emerald-50";
    if (score >= 70) return "text-amber-700 bg-amber-50";
    return "text-red-700 bg-red-50";
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return "bg-emerald-500";
    if (score >= 70) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Toolbar - hidden when printing */}
      <div className="print:hidden sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-sm font-black uppercase tracking-widest text-slate-700 hover:bg-slate-200 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <h1 className="text-sm font-black uppercase tracking-widest text-slate-500">Reporte de Auditoría</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Area Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">Todas las Áreas</option>
                {areaNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            
            {/* Edit Toggle */}
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                isEditing
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              {isEditing ? <Save className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
              {isEditing ? "Listo" : "Editar"}
            </button>
            
            {/* Print */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-950 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div ref={reportRef} className="max-w-[1200px] mx-auto px-8 py-10 print:px-4 print:py-2">
        {/* Header */}
        <div className="border-b-4 border-slate-900 pb-6 mb-8 print:mb-4 print:pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              {isEditing ? (
                <>
                  <input
                    value={editableTitle}
                    onChange={(e) => setEditableTitle(e.target.value)}
                    className="text-2xl font-black text-slate-900 uppercase tracking-tight border-b-2 border-blue-500 focus:outline-none w-full bg-blue-50/50 px-2 py-1 rounded"
                  />
                  <input
                    value={editableSubtitle}
                    onChange={(e) => setEditableSubtitle(e.target.value)}
                    className="text-lg font-bold text-slate-600 border-b-2 border-blue-500 focus:outline-none w-full bg-blue-50/50 px-2 py-1 rounded mt-1"
                  />
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{editableTitle}</h1>
                  <p className="text-lg font-bold text-slate-600">{editableSubtitle}</p>
                </>
              )}
            </div>
            <div className="text-right space-y-1">
              {isEditing ? (
                <>
                  <input
                    value={editableCompany}
                    onChange={(e) => setEditableCompany(e.target.value)}
                    className="text-sm font-black text-slate-900 uppercase tracking-widest border-b-2 border-blue-500 focus:outline-none text-right bg-blue-50/50 px-2 py-1 rounded"
                  />
                  <input
                    value={editableMonth}
                    onChange={(e) => setEditableMonth(e.target.value)}
                    className="text-sm font-bold text-slate-500 border-b-2 border-blue-500 focus:outline-none text-right bg-blue-50/50 px-2 py-1 rounded mt-1 block ml-auto"
                  />
                </>
              ) : (
                <>
                  <p className="text-sm font-black text-slate-900 uppercase tracking-widest">{editableCompany}</p>
                  <p className="text-sm font-bold text-slate-500 capitalize">Mes: {editableMonth}</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Summary Table - Puestos */}
        <div className="mb-10 print:mb-6">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Resumen por Puesto</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest">Puestos</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest">Resultado</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest">Auditorías</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest w-[200px]">Cumplimiento</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row, idx) => (
                  <tr
                    key={row.area}
                    className={cn(
                      "border-b border-slate-100 hover:bg-slate-50 transition-colors print:hover:bg-transparent",
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                    )}
                  >
                    <td className="px-4 py-3 font-bold text-slate-800">{row.area}</td>
                    <td className={cn("px-4 py-3 text-center font-black", getScoreColor(row.score))}>
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-lg">
                        {row.count > 0 ? `${row.score}%` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-600">{row.count}</td>
                    <td className="px-4 py-3">
                      {row.count > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden print:border print:border-slate-300">
                            <div
                              className={cn("h-full rounded-full transition-all", getScoreBg(row.score))}
                              style={{ width: `${row.score}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-black text-slate-500 w-8 text-right">{row.score}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="bg-slate-900 text-white font-black">
                  <td className="px-4 py-3 text-[10px] uppercase tracking-widest">Resultado General</td>
                  <td className="px-4 py-3 text-center text-lg">{overallScore}%</td>
                  <td className="px-4 py-3 text-center">{completedReports.length}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full" style={{ width: `${overallScore}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail per Person */}
        <div className="mb-10 print:mb-6">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Detalle por Proceso</h2>
          <div className="space-y-6 print:space-y-4">
            {personBreakdowns
              .filter(b => selectedArea === "all" || b.area === selectedArea)
              .map(breakdown => (
              <div key={breakdown.area} className="print:break-inside-avoid">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-3 border-b-2 border-slate-200 pb-2">
                  {breakdown.area}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">{breakdown.area}</th>
                        {breakdown.persons.map(p => (
                          <th key={p.name} className="px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {p.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="px-4 py-2.5 font-bold text-slate-700">Global</td>
                        {breakdown.persons.map(p => (
                          <td key={p.name} className={cn("px-4 py-2.5 text-center font-black", getScoreColor(p.average))}>
                            {p.average}%
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Item Breakdown */}
        {visibleReports.length > 0 && (
          <div className="mb-10 print:mb-6">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Detalle de Ítems Auditados</h2>
            <div className="space-y-8 print:space-y-4">
              {visibleReports.map((report) => {
                const sectionScores = getSectionScores(report.templateItems ?? [], report.session);
                return (
                  <div key={`${report.role}-${report.session.id}`} className="print:break-inside-avoid border border-slate-200 rounded-2xl overflow-hidden print:rounded-none print:border-slate-300">
                    {/* Report Header */}
                    <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-b border-slate-200 print:bg-slate-100">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{report.session.location} · {report.session.date}</p>
                        <h4 className="text-lg font-black text-slate-900 uppercase">{report.role}</h4>
                        <p className="text-xs font-bold text-slate-500">
                          {report.session.staffName || report.auditorName}
                          {report.session.orderNumber && ` · OR: ${report.session.orderNumber}`}
                        </p>
                      </div>
                      <div className={cn(
                        "px-5 py-3 rounded-xl text-center",
                        getScoreColor(report.session.totalScore || 0)
                      )}>
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Resultado</p>
                        <p className="text-2xl font-black">{report.session.totalScore}%</p>
                      </div>
                    </div>

                    {/* Section Scores Grid */}
                    {sectionScores.length > 1 && (
                      <div className="px-6 py-3 bg-white border-b border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-3">
                        {sectionScores.map(section => (
                          <div key={section.sectionName} className="text-center py-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{section.sectionName}</p>
                            <p className={cn("text-lg font-black", section.score >= 90 ? "text-emerald-600" : section.score >= 70 ? "text-amber-600" : "text-red-600")}>
                              {section.score}%
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Items Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-left">
                            <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 w-8">#</th>
                            <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Pregunta</th>
                            <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center w-24">Estado</th>
                            <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Observaciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(report.session.items || []).map((item, idx) => (
                            <tr key={item.id || idx} className={cn("border-t border-slate-100", idx % 2 === 0 ? "bg-white" : "bg-slate-50/30")}>
                              <td className="px-4 py-2.5 text-xs text-slate-400 font-bold">{idx + 1}</td>
                              <td className="px-4 py-2.5 text-xs font-medium text-slate-700 leading-snug">{item.question}</td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={cn(
                                  "inline-flex px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest",
                                  item.status === "pass" ? "bg-emerald-100 text-emerald-700 print:border print:border-emerald-300" :
                                  item.status === "fail" ? "bg-red-100 text-red-700 print:border print:border-red-300" :
                                  "bg-slate-100 text-slate-500 print:border print:border-slate-300"
                                )}>
                                  {item.status === "pass" ? "Cumple" : item.status === "fail" ? "No Cumple" : "N/A"}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-slate-500 italic max-w-[200px]">
                                {item.comment || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Editable Notes Section */}
        <div className="mb-10 print:mb-6 print:break-inside-avoid">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Observaciones Generales</h2>
          {isEditing ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Escribí tus observaciones aquí..."
              rows={4}
              className="w-full rounded-xl border-2 border-blue-500 bg-blue-50/30 px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y"
            />
          ) : notes ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-4">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{notes}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-4 print:hidden">
              <p className="text-sm text-slate-400 italic">Sin observaciones. Activá el modo edición para agregar.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t-2 border-slate-200 pt-4 text-center print:mt-8">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {appTitle} · Generado el {new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  );
}
