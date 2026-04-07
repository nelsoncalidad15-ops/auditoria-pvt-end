import { AlertCircle, CheckCircle2, Clock3, Database, FileCheck2, Link2, ShieldCheck, UploadCloud } from "lucide-react";

import { cn } from "../../lib/utils";

interface IntegrationsViewProps {
  webhookUrl: string;
  sheetCsvUrl: string;
  onWebhookUrlChange: (value: string) => void;
  onSheetCsvUrlChange: (value: string) => void;
  onSave: () => void;
  isFirebaseEnabled: boolean;
  isAuthenticated: boolean;
  isUsingExternalHistory: boolean;
  hasWebhookUrl: boolean;
  hasSheetCsvUrl: boolean;
  localAuditHistoryCount: number;
  historySyncModeLabel: string;
  lastSyncAt: string | null;
  lastSyncMessage: string;
  lastExportedAt: string | null;
  lastIntegrationSavedAt: string | null;
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

function StatusPill({ active, activeLabel, inactiveLabel }: { active: boolean; activeLabel: string; inactiveLabel: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]",
        active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
      )}
    >
      {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

export function IntegrationsView({
  webhookUrl,
  sheetCsvUrl,
  onWebhookUrlChange,
  onSheetCsvUrlChange,
  onSave,
  isFirebaseEnabled,
  isAuthenticated,
  isUsingExternalHistory,
  hasWebhookUrl,
  hasSheetCsvUrl,
  localAuditHistoryCount,
  historySyncModeLabel,
  lastSyncAt,
  lastSyncMessage,
  lastExportedAt,
  lastIntegrationSavedAt,
}: IntegrationsViewProps) {
  const operationalAlerts = [
    !hasWebhookUrl ? "Falta Apps Script." : null,
    !hasSheetCsvUrl ? "Falta CSV." : null,
    localAuditHistoryCount > 0 ? `${localAuditHistoryCount} pendientes locales.` : null,
    isFirebaseEnabled && !isAuthenticated ? "Firebase sin sesion." : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="space-y-6 pb-12">
      <div className="rounded-[2.4rem] border border-white/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,118,110,0.92))] p-7 text-white shadow-xl shadow-slate-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100/70">Integraciones</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight">Conectividad y respaldo</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:w-[340px]">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/70">Ultima sync</p>
              <p className="mt-2 text-sm font-black">{formatTimestamp(lastSyncAt)}</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/70">Ultima exportacion</p>
              <p className="mt-2 text-sm font-black">{formatTimestamp(lastExportedAt)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-4">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Configuracion</p>
                <h4 className="mt-2 text-lg font-black text-slate-900">Fuentes</h4>
              </div>
              <StatusPill active={hasWebhookUrl || hasSheetCsvUrl} activeLabel="Lista" inactiveLabel="Incompleta" />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <label className="px-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Endpoint Apps Script</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(event) => onWebhookUrlChange(event.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="px-1 text-[10px] font-black uppercase tracking-widest text-gray-400">CSV publicado de Sheets</label>
                <input
                  type="url"
                  value={sheetCsvUrl}
                  onChange={(event) => onSheetCsvUrlChange(event.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/.../pub?output=csv"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div>
                <p className="text-sm font-black text-slate-900">Guardado</p>
                <p className="mt-1 text-sm font-medium text-slate-500">{formatTimestamp(lastIntegrationSavedAt)}</p>
              </div>
              <button
                onClick={onSave}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-slate-800"
              >
                Guardar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", hasWebhookUrl ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Apps Script</p>
                  <p className="text-sm font-black text-slate-900">{hasWebhookUrl ? "Activo" : "Pendiente"}</p>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-500">{hasWebhookUrl ? "Activo." : "Pendiente."}</p>
            </div>

            <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", hasSheetCsvUrl ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Historial externo</p>
                  <p className="text-sm font-black text-slate-900">{historySyncModeLabel}</p>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-500">{isUsingExternalHistory ? "Activo." : hasSheetCsvUrl ? "Disponible." : "Pendiente."}</p>
            </div>

            <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", isAuthenticated ? "bg-emerald-50 text-emerald-600" : isFirebaseEnabled ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500")}>
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Persistencia</p>
                  <p className="text-sm font-black text-slate-900">{isFirebaseEnabled ? (isAuthenticated ? "Firestore listo" : "Esperando acceso") : "Modo local / Sheets"}</p>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-500">{isFirebaseEnabled ? (isAuthenticated ? "Listo." : "Sin acceso.") : "Modo local."}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Seguimiento</p>
                <p className="text-sm font-black text-slate-900">Ultimo evento</p>
              </div>
            </div>
            <p className="mt-4 text-sm font-medium text-slate-600">{lastSyncMessage}</p>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Ultima sincronizacion</p>
                <p className="mt-2 text-sm font-black text-slate-900">{formatTimestamp(lastSyncAt)}</p>
              </div>
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cola local</p>
                <p className="mt-2 text-sm font-black text-slate-900">{localAuditHistoryCount} pendientes</p>
              </div>
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Ultima exportacion</p>
                <p className="mt-2 text-sm font-black text-slate-900">{formatTimestamp(lastExportedAt)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Checklist</p>
                <p className="text-sm font-black text-slate-900">Monitoreo</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {(operationalAlerts.length > 0 ? operationalAlerts : ["Sin alertas."]).map((alert) => (
                <div key={alert} className="flex items-start gap-3 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
                  <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <p className="text-sm font-medium text-slate-600">{alert}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
