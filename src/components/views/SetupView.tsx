import { ArrowLeft, Calendar, Check, ChevronRight, ClipboardEdit, MapPin, User } from "lucide-react";
import { cn } from "../../lib/utils";
import { Auditor, Location } from "../../types";

interface SetupViewProps {
  dateLabel?: string;
  auditors: Auditor[];
  locations: readonly Location[];
  selectedAuditorId?: string;
  selectedLocation?: Location;
  auditBatchDisplayName?: string;
  onSelectAuditor: (auditorId: string) => void;
  onSelectLocation: (location: Location) => void;
  onAuditNameChange?: (name: string) => void;
  onCancel: () => void;
  onContinue: () => void;
}

export function SetupView({ dateLabel, auditors, locations, selectedAuditorId, selectedLocation, auditBatchDisplayName, onSelectAuditor, onSelectLocation, onAuditNameChange, onCancel, onContinue }: SetupViewProps) {
  const canContinue = Boolean(selectedAuditorId && selectedLocation);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 py-2">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Nueva auditoría</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Datos iniciales</h2>
          <p className="mt-1 text-xs font-medium text-slate-500">Definí estos datos una sola vez. Después elegís el tipo y el área.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600"><Calendar className="h-4 w-4 text-blue-600" /> {dateLabel || "Hoy"}</div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500"><User className="h-4 w-4" /> Auditor</span>
            <select value={selectedAuditorId || ""} onChange={(event) => onSelectAuditor(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
              <option value="">Seleccionar auditor</option>
              {auditors.map((auditor) => <option key={auditor.id} value={auditor.id}>{auditor.name}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500"><MapPin className="h-4 w-4" /> Sucursal</span>
            <select value={selectedLocation || ""} onChange={(event) => onSelectLocation(event.target.value as Location)} className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
              <option value="">Seleccionar sucursal</option>
              {locations.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>
          </label>
        </div>
        <label className="mt-4 block space-y-2">
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500"><ClipboardEdit className="h-4 w-4" /> Nombre de la auditoría <span className="font-medium normal-case tracking-normal text-slate-400">(opcional)</span></span>
          <input value={auditBatchDisplayName || ""} onChange={(event) => onAuditNameChange?.(event.target.value)} placeholder="Ej.: Control Postventa - Septiembre" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" />
          <p className="text-[11px] font-medium text-slate-400">Sirve para identificarla y evita mezclarla con auditorías anteriores.</p>
        </label>
      </section>

      <footer className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onCancel} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Cancelar</button>
        <button type="button" onClick={onContinue} disabled={!canContinue} className={cn("inline-flex h-12 items-center justify-center gap-2 rounded-xl px-7 text-xs font-black uppercase tracking-wider transition", canContinue ? "bg-slate-950 text-white shadow-lg hover:bg-blue-700" : "cursor-not-allowed bg-slate-100 text-slate-300")}>{canContinue && <Check className="h-4 w-4" />} Continuar <ChevronRight className="h-4 w-4" /></button>
      </footer>
    </div>
  );
}
