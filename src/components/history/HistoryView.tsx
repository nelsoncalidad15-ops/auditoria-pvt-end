import { memo } from "react";
import { AlertCircle, ArrowLeft, ChevronRight, ClipboardList, Clock, FileText, History, Save, Search, TrendingUp, Trash2 } from "lucide-react";

import { cn } from "../../lib/utils";
import { AuditSession, HistoryPanel } from "../../types";

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
  onDeleteAudit: (audit: AuditSession) => void;
  onExportCsv: () => void;
  onSyncData: () => void;
  isSyncing: boolean;
  isHistorySyncConfigured: boolean;
  isUsingExternalHistory: boolean;
  hasWebhookUrl: boolean;
  hasSheetCsvUrl: boolean;
  totalHistoryCount: number;
  historySyncModeLabel: string;
  localAuditHistoryCount: number;
  lastSyncAt: string | null;
  lastExportedAt: string | null;
  lastSyncMessage: string;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Pendiente";
  }

  return new Date(value).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export const HistoryView = memo(function HistoryView({
  historyPanel,
  setHistoryPanel,
  filteredHistory,
  selectedHistoryAudit,
  historyAverageScore,
  nonCompliantAudits,
  latestHistoryItem,
  searchTerm,
  setSearchTerm,
  onBack,
  onSelectAudit,
  onExportCsv,
  onSyncData,
  onDeleteAudit,
  isSyncing,
  isHistorySyncConfigured,
  isUsingExternalHistory,
  hasWebhookUrl,
  hasSheetCsvUrl,
  totalHistoryCount,
  historySyncModeLabel,
  localAuditHistoryCount,
  lastSyncAt,
  lastExportedAt,
  lastSyncMessage,
}: HistoryViewProps) {
  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-500 font-black uppercase tracking-[0.2em] text-[10px]">
            <History className="h-4 w-4" />
            Trazabilidad y Control
          </div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Historial de Auditorías</h2>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setHistoryPanel("exports")} 
            className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-6 py-3.5 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 transition-all hover:bg-slate-50 dark:hover:bg-white/10"
          >
            <FileText className="h-4 w-4" />
            Gestionar Sync
          </button>
          <button 
            onClick={onExportCsv} 
            className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-emerald-500 shadow-lg shadow-emerald-500/20"
          >
            <Save className="h-4 w-4" />
            CSV
          </button>
        </div>
      </div>

      <div className="premium-card p-1.5 bg-slate-200/50 dark:bg-white/5 mb-8">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setHistoryPanel("records")}
            className={cn(
              "rounded-[1.25rem] px-6 py-3.5 text-center transition-all font-black text-xs uppercase tracking-widest",
              historyPanel === "records"
                ? "bg-white dark:bg-white text-slate-950 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            Listado de Registros
          </button>
          <button
            onClick={() => setHistoryPanel("exports")}
            className={cn(
              "rounded-[1.25rem] px-6 py-3.5 text-center transition-all font-black text-xs uppercase tracking-widest",
              historyPanel === "exports"
                ? "bg-white dark:bg-white text-slate-950 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            Exportación y Sync
          </button>
        </div>
      </div>

      {historyPanel === "records" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total", value: filteredHistory.length, icon: ClipboardList, color: "text-blue-500", bg: "bg-blue-500/10" },
              { label: "Cumplimiento", value: `${historyAverageScore}%`, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
              { label: "Desvíos", value: nonCompliantAudits, icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-500/10" },
              { label: "Auditores", value: totalHistoryCount, icon: Clock, color: "text-slate-500", bg: "bg-slate-500/10" },
            ].map((card) => (
              <div key={card.label} className="premium-card p-5 bg-white dark:bg-white/5 border-white/5">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center", card.bg, card.color)}>
                    <card.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{card.label}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white leading-none">{card.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
            <div className="space-y-4">
              <div className="premium-card p-4 bg-white/50 dark:bg-white/5 border-slate-200 dark:border-white/5">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar por colaborador, OR o ubicación..." 
                    value={searchTerm} 
                    onChange={(event) => setSearchTerm(event.target.value)} 
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 py-4 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
                  />
                </div>
              </div>

              <div className="space-y-3">
                {filteredHistory.map((item) => (
                  <button 
                    key={item.id} 
                    onClick={() => onSelectAudit(item)} 
                    className={cn(
                      "group w-full premium-card p-5 text-left transition-all relative overflow-hidden", 
                      selectedHistoryAudit?.id === item.id 
                        ? "bg-slate-900 dark:bg-white border-none shadow-xl" 
                        : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/5 hover:border-blue-400 dark:hover:border-blue-500/50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-4 relative z-10">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={cn(
                          "h-14 w-14 shrink-0 rounded-2xl flex flex-col items-center justify-center border-2",
                          selectedHistoryAudit?.id === item.id 
                            ? "bg-white/10 border-white/20 text-white dark:text-slate-900" 
                            : item.totalScore >= 90 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : 
                              item.totalScore >= 70 ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-red-500/10 border-red-500/20 text-red-500"
                        )}>
                          <span className="text-[8px] font-black uppercase tracking-tighter opacity-60 leading-none">Score</span>
                          <span className="text-lg font-black">{item.totalScore}%</span>
                        </div>
                        <div className="min-w-0">
                          <p className={cn("text-sm font-black truncate", selectedHistoryAudit?.id === item.id ? "text-white dark:text-slate-900" : "text-slate-900 dark:text-white")}>
                            {item.staffName || "Sin responsable"}
                          </p>
                          <p className={cn("text-[10px] font-bold uppercase tracking-widest mt-0.5", selectedHistoryAudit?.id === item.id ? "text-slate-400 dark:text-slate-500" : "text-slate-400")}>
                            {item.date} • {item.location}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteAudit(item);
                          }}
                          className={cn(
                            "h-9 w-9 rounded-xl flex items-center justify-center transition-all active:scale-90",
                            selectedHistoryAudit?.id === item.id 
                              ? "bg-white/10 text-white hover:bg-white/20" 
                              : "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
                          )}
                          title="Eliminar registro"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <ChevronRight className={cn("h-5 w-5 transition-transform group-hover:translate-x-1", selectedHistoryAudit?.id === item.id ? "text-white dark:text-slate-900" : "text-slate-300")} />
                      </div>
                    </div>
                    <div className={cn(
                      "mt-4 pt-4 border-t flex items-center justify-between",
                      selectedHistoryAudit?.id === item.id ? "border-white/10 dark:border-slate-200" : "border-slate-100 dark:border-white/5"
                    )}>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg", selectedHistoryAudit?.id === item.id ? "bg-white/10 text-white dark:bg-slate-900/10 dark:text-slate-900" : "bg-slate-100 dark:bg-white/5 text-slate-500")}>
                          {item.role || item.items[0]?.category}
                        </span>
                        {item.orderNumber && (
                          <span className={cn("text-[9px] font-black uppercase tracking-widest", selectedHistoryAudit?.id === item.id ? "text-blue-400" : "text-blue-600")}>
                            OR: {item.orderNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}

                {filteredHistory.length === 0 && (
                  <div className="premium-card py-20 px-8 bg-slate-50 dark:bg-white/5 border-dashed border-2 border-slate-200 dark:border-white/10 text-center space-y-4">
                    <div className="h-16 w-16 rounded-3xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto text-slate-400">
                      <Search className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-900 dark:text-white uppercase italic">Sin Resultados</p>
                      <p className="text-sm font-medium text-slate-500 max-w-[200px] mx-auto">No encontramos auditorías que coincidan con tu búsqueda.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {selectedHistoryAudit ? (
                <div className="glass-panel space-y-5 rounded-[2rem] p-6 shadow-sm xl:sticky xl:top-28">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Detalle</p>
                      <h3 className="mt-2 text-xl font-black text-slate-950">{selectedHistoryAudit.location}</h3>
                      <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">{selectedHistoryAudit.role || selectedHistoryAudit.items[0]?.category} ? {selectedHistoryAudit.date}</p>
                    </div>
                    <div className={cn("rounded-2xl px-4 py-3 text-lg font-black", selectedHistoryAudit.totalScore >= 90 ? "bg-green-50 text-green-600" : selectedHistoryAudit.totalScore >= 70 ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-600")}>{selectedHistoryAudit.totalScore}%</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {selectedHistoryAudit.role !== "Pre Entrega" && <div className="rounded-[1.4rem] border border-slate-200 bg-white px-4 py-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Personal</p><p className="mt-2 text-sm font-black text-slate-900">{selectedHistoryAudit.staffName || "N/A"}</p></div>}
                    <div className="rounded-[1.4rem] border border-slate-200 bg-white px-4 py-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Ubicacion</p><p className="mt-2 text-sm font-black text-slate-900">{selectedHistoryAudit.location}</p></div>
                    {selectedHistoryAudit.orderNumber && <div className="col-span-2 rounded-[1.4rem] border border-slate-200 bg-white px-4 py-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Orden</p><p className="mt-2 text-sm font-black text-blue-600">{selectedHistoryAudit.orderNumber}</p></div>}
                    {selectedHistoryAudit.auditedFileNames?.some((name) => name?.trim()) && (
                      <div className="col-span-2 rounded-[1.4rem] border border-slate-200 bg-white px-4 py-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Legajos auditados</p>
                        <p className="mt-2 text-sm font-black text-slate-900">{selectedHistoryAudit.auditedFileNames.filter((name) => name?.trim()).join(" ? ")}</p>
                      </div>
                    )}
                  </div>

                  <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Items</p>
                    {selectedHistoryAudit.items.map((item, index) => (
                      <div key={index} className="render-optimized-card space-y-2 rounded-[1.4rem] border border-slate-200 bg-white px-4 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-xs font-bold leading-snug text-slate-700">{item.question}</p>
                          <span className={cn("shrink-0 rounded-lg px-2 py-1 text-[10px] font-black uppercase", item.status === "pass" ? "bg-green-100 text-green-600" : item.status === "fail" ? "bg-red-100 text-red-600" : "bg-slate-200 text-slate-500")}>{item.status === "pass" ? "Cumple" : item.status === "fail" ? "No cumple" : "N/A"}</span>
                        </div>
                        {item.comment && <p className="text-[11px] italic text-slate-500">"{item.comment}"</p>}
                      </div>
                    ))}
                  </div>

                  {selectedHistoryAudit.notes && <div className="rounded-[1.4rem] border border-blue-100 bg-blue-50 px-4 py-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-400">Notas</p><p className="mt-2 text-sm leading-relaxed text-blue-800">{selectedHistoryAudit.notes}</p></div>}
                </div>
              ) : (
                <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
                  <p className="text-sm font-black text-slate-700">Selecciona una auditoria.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {historyPanel === "exports" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="glass-panel space-y-5 rounded-[2rem] p-6 shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Exportacion</p>
              <h3 className="mt-2 text-xl font-black text-slate-950">Salida y respaldo</h3>
              <p className="mt-2 text-sm font-medium text-slate-500">Modelo habitual en sistemas de auditoria: exportar para analisis puntual y sincronizar con una fuente compartida para reporting externo.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-[1.6rem] border border-slate-200 bg-white p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">CSV local</p>
                <p className="text-sm font-medium text-slate-500">Descarga el historial para compartirlo, archivarlo o cruzarlo externamente.</p>
                <button onClick={onExportCsv} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-slate-800"><Save className="h-4 w-4" />Exportar ahora</button>
              </div>
              <div className="space-y-3 rounded-[1.6rem] border border-slate-200 bg-white p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Fuente externa</p>
                <p className="text-sm font-medium text-slate-500">Leer el CSV publicado permite verificar consistencia y operacion fuera de la app.</p>
                <button onClick={onSyncData} disabled={isSyncing || !isHistorySyncConfigured} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-700 transition-all hover:border-slate-300 disabled:opacity-50"><Clock className="h-4 w-4" />{isSyncing ? "Sincronizando..." : "Leer fuente"}</button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2 rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Ultima sincronizacion</p>
                <p className="text-sm font-black text-slate-900">{formatTimestamp(lastSyncAt)}</p>
                <p className="text-sm font-medium text-slate-500">{lastSyncMessage}</p>
              </div>
              <div className="space-y-2 rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Ultima exportacion</p>
                <p className="text-sm font-black text-slate-900">{formatTimestamp(lastExportedAt)}</p>
                <p className="text-sm font-medium text-slate-500">Disponible para compartir o respaldar fuera de la app.</p>
              </div>
              <div className="space-y-2 rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cola local</p>
                <p className="text-sm font-black text-slate-900">{localAuditHistoryCount} pendientes</p>
                <p className="text-sm font-medium text-slate-500">Modo de sincronizacion: {historySyncModeLabel}.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="glass-panel space-y-4 rounded-[2rem] p-6 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Criterio</p>
              <div className="space-y-3 text-sm font-medium text-slate-600">
                <p>Firestore como fuente oficial para trazabilidad y control.</p>
                <p>Sheets o CSV como capa de intercambio y reporting operativo.</p>
                <p>Exportar y sincronizar por separado.</p>
              </div>
            </div>
            <div className="space-y-3 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Estado actual</p>
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4"><p className="text-sm font-black text-slate-900">Fuente</p><p className="mt-2 text-sm font-medium text-slate-500">{isUsingExternalHistory ? "Sheets." : hasWebhookUrl ? "Apps Script." : hasSheetCsvUrl ? "CSV." : "Pendiente."}</p></div>
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4"><p className="text-sm font-black text-slate-900">Total de registros</p><p className="mt-2 text-sm font-medium text-slate-500">{totalHistoryCount} auditorias disponibles para exportar.</p></div>
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4"><p className="text-sm font-black text-slate-900">Control</p><p className="mt-2 text-sm font-medium text-slate-500">Sync, exportacion y cola local.</p></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

