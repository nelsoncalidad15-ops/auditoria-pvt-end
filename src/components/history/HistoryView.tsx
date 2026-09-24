import { memo, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, Clock3, Pencil, Play, Search, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { AuditSession, HistoryPanel, IncompleteAuditListItem } from "../../types";

interface HistoryViewProps {
  historyPanel: HistoryPanel;
  setHistoryPanel: (panel: HistoryPanel) => void;
  filteredHistory: AuditSession[];
  selectedHistoryAudit: AuditSession | null;
  historyAverageScore: number;
  nonCompliantAudits: number;
  latestHistoryItem: AuditSession | null;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  onBack: () => void;
  onSelectAudit: (audit: AuditSession) => void;
  onEditAudit: (audit: AuditSession) => void;
  onDeleteAudit: (audit: AuditSession) => void;
  onExportCsv: () => void;
  onSyncData: () => void;
  isSyncing: boolean;
  isHistorySyncConfigured: boolean;
  canManageRecords: boolean;
  isUsingExternalHistory: boolean;
  hasWebhookUrl: boolean;
  hasSheetCsvUrl: boolean;
  totalHistoryCount: number;
  historySyncModeLabel: string;
  localAuditHistoryCount: number;
  lastSyncAt: string | null;
  lastExportedAt: string | null;
  lastSyncMessage: string;
  pendingAudits?: IncompleteAuditListItem[];
  onResumePending?: (audit: IncompleteAuditListItem) => void;
  onDeletePending?: (audit: IncompleteAuditListItem) => void;
}

function getAuditArea(audit: AuditSession) {
  return audit.role || audit.items?.[0]?.category || "General";
}

function getAuditType(audit: AuditSession) {
  const areas = new Set((audit.childAudits || []).map((child) => child.role || child.items?.[0]?.category).filter(Boolean));
  return audit.role === "General" || areas.size > 1 ? "Integral" : "Por área";
}

function getPendingProgress(audit: IncompleteAuditListItem) {
  const total = audit._source === "history" && audit.expectedChildCount ? audit.expectedChildCount : audit.items?.length || 0;
  const completed = audit._source === "history" ? audit.childAudits?.length || 0 : audit.items?.filter((item) => item.status).length || 0;
  return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

export const HistoryView = memo(function HistoryView({
  filteredHistory,
  searchTerm,
  setSearchTerm,
  onSelectAudit,
  onEditAudit,
  onDeleteAudit,
  canManageRecords,
  pendingAudits = [],
  onResumePending,
  onDeletePending,
}: HistoryViewProps) {
  const [activeTab, setActiveTab] = useState<"finished" | "pending">("finished");
  const [areaFilter, setAreaFilter] = useState("all");
  const availableAreas = useMemo(() => Array.from(new Set(filteredHistory.map(getAuditArea))).sort(), [filteredHistory]);
  const visibleHistory = useMemo(() => filteredHistory.filter((audit) => areaFilter === "all" || getAuditArea(audit) === areaFilter), [areaFilter, filteredHistory]);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Auditorías</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Historial</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Consultá auditorías cerradas o retomá trabajos pendientes.</p>
        </div>
        <div className="inline-grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button type="button" onClick={() => setActiveTab("finished")} className={cn("rounded-lg px-4 py-2.5 text-[10px] font-black uppercase tracking-wider", activeTab === "finished" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500")}><CheckCircle2 className="mr-2 inline h-4 w-4" />Finalizadas <span className="ml-1 opacity-60">{filteredHistory.length}</span></button>
          <button type="button" onClick={() => setActiveTab("pending")} className={cn("rounded-lg px-4 py-2.5 text-[10px] font-black uppercase tracking-wider", activeTab === "pending" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500")}><Clock3 className="mr-2 inline h-4 w-4" />Pendientes <span className="ml-1 opacity-60">{pendingAudits.length}</span></button>
        </div>
      </header>

      {activeTab === "finished" ? (
        <>
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[1fr_220px]">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por nombre, área, OR o sucursal" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium outline-none focus:border-blue-400" /></div>
            <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-400"><option value="all">Todas las áreas</option>{availableAreas.map((area) => <option key={area} value={area}>{area}</option>)}</select>
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {visibleHistory.length > 0 ? <div className="divide-y divide-slate-100">{visibleHistory.map((audit) => {
              const area = getAuditArea(audit);
              const deviations = (audit.items || []).filter((item) => item.status === "fail").length;
              return <article key={audit.id} className="grid gap-3 px-4 py-4 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_130px_105px_auto] sm:items-center">
                <button type="button" onClick={() => onSelectAudit(audit)} className="min-w-0 text-left"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-black text-slate-900">{audit.auditBatchName || area}</p><span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-600">{getAuditType(audit)}</span><span className="rounded-md bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-700">Finalizada</span></div><p className="mt-1 text-xs font-medium text-slate-500">{area}{audit.orderNumber ? ` · OR ${audit.orderNumber}` : ""} · {audit.location || "Sin sucursal"}</p></button>
                <div className="text-xs font-bold text-slate-500"><p>{audit.date}</p><p className="mt-1">{audit.staffName || "Sin responsable"}</p></div>
                <div><span className={cn("text-lg font-black", audit.totalScore >= 90 ? "text-emerald-600" : audit.totalScore >= 70 ? "text-amber-600" : "text-rose-600")}>{audit.totalScore}%</span><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{deviations} desvío{deviations === 1 ? "" : "s"}</p></div>
                <div className="flex items-center justify-end gap-1"><button type="button" onClick={() => onSelectAudit(audit)} className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-[10px] font-black uppercase text-blue-700 hover:bg-blue-50">Ver <ChevronRight className="h-3.5 w-3.5" /></button>{canManageRecords && <><button type="button" title="Editar" onClick={() => onEditAudit(audit)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button><button type="button" title="Eliminar" onClick={() => onDeleteAudit(audit)} className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button></>}</div>
              </article>;
            })}</div> : <div className="p-12 text-center text-sm font-bold text-slate-500">No hay auditorías finalizadas con esos filtros.</div>}
          </section>
        </>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {pendingAudits.length > 0 ? <div className="divide-y divide-slate-100">{pendingAudits.map((audit) => {
            const progress = getPendingProgress(audit);
            const area = audit.role || audit.items?.[0]?.category || "General";
            return <article key={audit.id} className="grid gap-3 px-4 py-4 hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-black text-slate-900">{audit.auditBatchName || "Auditoría sin nombre"}</p><span className="rounded-md bg-amber-50 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-700">Pendiente</span></div><p className="mt-1 text-xs font-medium text-slate-500">{area} · {audit.location || "Sin sucursal"} · {audit.date}</p></div><div><div className="mb-1 flex justify-between text-[10px] font-bold text-slate-500"><span>Progreso</span><span>{progress.percent}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${progress.percent}%` }} /></div></div><div className="flex justify-end gap-2"><button type="button" onClick={() => onResumePending?.(audit)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-[10px] font-black uppercase tracking-wider text-white"><Play className="h-4 w-4" />Continuar</button>{canManageRecords && <button type="button" title="Eliminar borrador" onClick={() => onDeletePending?.(audit)} className="flex h-10 w-10 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>}</div></article>;
          })}</div> : <div className="p-12 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" /><p className="mt-3 text-sm font-black text-slate-700">No hay auditorías pendientes</p><p className="mt-1 text-xs text-slate-500">Todo el trabajo iniciado está finalizado.</p></div>}
        </section>
      )}
    </div>
  );
});
