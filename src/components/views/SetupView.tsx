import { 
  ArrowLeft, 
  Check, 
  ChevronRight, 
  MapPin, 
  User, 
  Calendar,
  Info
} from "lucide-react";
import { motion } from "motion/react";
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
  onCancel: () => void;
  onContinue: () => void;
}

export function SetupView({
  dateLabel,
  auditors,
  locations,
  selectedAuditorId,
  selectedLocation,
  auditBatchDisplayName,
  onSelectAuditor,
  onSelectLocation,
  onCancel,
  onContinue,
}: SetupViewProps) {
  const canContinue = Boolean(selectedAuditorId && selectedLocation);

  return (
    <div className="max-w-4xl mx-auto space-y-10 py-6">
      {/* Hero Section */}
      <div className="space-y-4 px-2">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-black uppercase tracking-[0.2em] text-[10px]">
          <Settings2 className="h-4 w-4" />
          Configuración Inicial
        </div>
        <h2 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Preparar Auditoría</h2>
        <p className="text-lg text-slate-500 dark:text-slate-400 font-medium">Define los parámetros de la sesión antes de comenzar el relevamiento.</p>
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="premium-card p-6 bg-white dark:bg-slate-900 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha de Referencia</p>
            <p className="text-lg font-black">{dateLabel || "Hoy"}</p>
          </div>
        </div>
        <div className={cn(
          "premium-card p-6 flex items-center gap-4 transition-all duration-500",
          canContinue ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800" : "bg-white dark:bg-slate-900"
        )}>
          <div className={cn(
            "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors",
            canContinue ? "bg-emerald-100 text-emerald-600" : "bg-slate-50 dark:bg-slate-800 text-slate-400"
          )}>
            {canContinue ? <Check className="h-6 w-6" /> : <Info className="h-6 w-6" />}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</p>
            <p className={cn("text-lg font-black", canContinue ? "text-emerald-700" : "text-slate-500")}>
              {canContinue ? "Listo para iniciar" : "Pendiente de selección"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Auditor Selection */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Seleccionar Auditor</h3>
            <User className="h-4 w-4 text-slate-300" />
          </div>
          <div className="space-y-3">
            {auditors.map((auditor, i) => {
              const isActive = selectedAuditorId === auditor.id;
              return (
                <motion.button
                  key={auditor.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => onSelectAuditor(auditor.id)}
                  className={cn(
                    "w-full premium-card p-5 text-left flex items-center justify-between transition-all group",
                    isActive 
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-none shadow-xl scale-[1.02]" 
                      : "bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center font-black",
                      isActive ? "bg-white/10" : "bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:bg-blue-50 transition-colors"
                    )}>
                      {auditor.name.charAt(0)}
                    </div>
                    <p className="font-bold">{auditor.name}</p>
                  </div>
                  {isActive && <Check className="h-5 w-5" />}
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Location Selection */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Seleccionar Sucursal</h3>
            <MapPin className="h-4 w-4 text-slate-300" />
          </div>
          <div className="grid grid-cols-1 gap-3">
            {locations.map((location, i) => {
              const isActive = selectedLocation === location;
              return (
                <motion.button
                  key={location}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => onSelectLocation(location)}
                  className={cn(
                    "w-full premium-card p-5 text-left flex items-center justify-between transition-all group",
                    isActive 
                      ? "bg-blue-600 text-white border-none shadow-xl scale-[1.02]" 
                      : "bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center",
                      isActive ? "bg-white/20" : "bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:bg-blue-50 transition-colors"
                    )}>
                      <MapPin className="h-5 w-5" />
                    </div>
                    <p className="font-bold">{location}</p>
                  </div>
                  {isActive && <Check className="h-5 w-5" />}
                </motion.button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Footer Info & Actions */}
      <div className="pt-8 space-y-6">
        {selectedLocation && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="premium-card p-6 bg-slate-50 dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-700"
          >
            <div className="flex items-start gap-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre de la Auditoría</p>
                <p className="text-sm font-bold mt-1">{auditBatchDisplayName || "Generando nombre automático..."}</p>
              </div>
            </div>
          </motion.div>
        )}

        <div className="flex items-center justify-between gap-4">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
            Volver
          </button>
          <button
            onClick={onContinue}
            disabled={!canContinue}
            className={cn(
              "flex items-center gap-2 px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg",
              canContinue 
                ? "bg-slate-950 text-white shadow-slate-300 dark:shadow-none hover:bg-black active:scale-95" 
                : "bg-slate-100 text-slate-300 cursor-not-allowed shadow-none"
            )}
          >
            Continuar a Auditoría
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

import { Settings2, ClipboardCheck } from "lucide-react";
