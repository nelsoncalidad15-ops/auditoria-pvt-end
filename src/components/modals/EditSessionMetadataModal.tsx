import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, User, Hash, Pencil, Check, Wrench, ShieldCheck, Droplets, PackageCheck } from "lucide-react";
import { AuditSession, OrAuditParticipants } from "../../types";
import { Button } from "../ui/Button";
import { OR_PARTICIPANTS } from "../../constants";
import { cn } from "../../lib/utils";

interface EditSessionMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Partial<AuditSession>;
  isOrdersAudit: boolean;
  participantOptions?: Record<keyof OrAuditParticipants, string[]>;
  onSave: (data: {
    staffName: string;
    orderNumber: string;
    participants: Partial<OrAuditParticipants>;
  }) => void;
}

export function EditSessionMetadataModal({
  isOpen,
  onClose,
  session,
  isOrdersAudit,
  participantOptions,
  onSave,
}: EditSessionMetadataModalProps) {
  const currentAdvisor = (session.participants?.asesorServicio || session.staffName || "").trim();
  const [advisorName, setAdvisorName] = useState(currentAdvisor);
  const [orderNumber, setOrderNumber] = useState(session.orderNumber || "");
  const [tecnico, setTecnico] = useState(session.participants?.tecnico || "");
  const [controller, setController] = useState(session.participants?.controller || "");
  const [lavador, setLavador] = useState(session.participants?.lavador || "");
  const [repuestos, setRepuestos] = useState(session.participants?.repuestos || "");

  useEffect(() => {
    if (isOpen) {
      setAdvisorName((session.participants?.asesorServicio || session.staffName || "").trim());
      setOrderNumber(session.orderNumber || "");
      setTecnico(session.participants?.tecnico || "");
      setController(session.participants?.controller || "");
      setLavador(session.participants?.lavador || "");
      setRepuestos(session.participants?.repuestos || "");
    }
  }, [isOpen, session]);

  const advisorOptions = useMemo(() => {
    const fromOptions = participantOptions?.asesorServicio || [];
    const fromConstants = OR_PARTICIPANTS.asesorServicio || [];
    const combined = Array.from(new Set([...fromOptions, ...fromConstants, "Tatiana", currentAdvisor])).filter(Boolean);
    return combined;
  }, [currentAdvisor, participantOptions?.asesorServicio]);

  const getOptions = (field: keyof OrAuditParticipants) => {
    const list = participantOptions?.[field]?.length ? participantOptions[field] : OR_PARTICIPANTS[field];
    return Array.from(new Set(list || [])).filter(Boolean);
  };

  const handleSave = () => {
    const cleanAdvisor = advisorName.trim();
    if (!cleanAdvisor) {
      alert("Por favor indicá el nombre del asesor.");
      return;
    }

    onSave({
      staffName: cleanAdvisor,
      orderNumber: orderNumber.trim(),
      participants: {
        ...(session.participants || {}),
        asesorServicio: cleanAdvisor,
        ...(isOrdersAudit ? {
          tecnico: tecnico.trim(),
          controller: controller.trim(),
          lavador: lavador.trim(),
          repuestos: repuestos.trim(),
        } : {}),
      },
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                  <Pencil className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                    Editar datos de la auditoría
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400">
                    Modificá el asesor o participantes asignados a esta OR
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {/* Asesor de servicio */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <User className="h-3.5 w-3.5 text-blue-600" />
                  Asesor de Servicio / Responsable
                </label>
                
                {/* Quick selection chips */}
                <div className="flex flex-wrap gap-1.5">
                  {advisorOptions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setAdvisorName(name)}
                      className={cn(
                        "rounded-xl border px-3 py-1.5 text-xs font-black transition",
                        advisorName === name
                          ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
                      )}
                    >
                      {advisorName === name && <Check className="mr-1 inline-block h-3 w-3" />}
                      {name}
                    </button>
                  ))}
                </div>

                <div className="mt-2">
                  <input
                    type="text"
                    value={advisorName}
                    onChange={(e) => setAdvisorName(e.target.value)}
                    placeholder="Escribir nombre del asesor..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-white/10 dark:bg-slate-800 dark:text-white"
                  />
                  <p className="mt-1 text-[10px] font-medium text-slate-400">
                    Podés seleccionar de la lista superior o ingresar un nuevo nombre directamente.
                  </p>
                </div>
              </div>

              {/* Número de OR */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <Hash className="h-3.5 w-3.5 text-indigo-500" />
                  Número de OR
                </label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="Ej: 263770"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white dark:border-white/10 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Otros participantes (solo para flujo de ORs) */}
              {isOrdersAudit && (
                <div className="space-y-3 pt-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Equipo de taller y soporte
                  </p>
                  
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {/* Técnico */}
                    <div className="space-y-1">
                      <label className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
                        <Wrench className="h-3 w-3 text-emerald-600" />
                        Técnico
                      </label>
                      <select
                        value={tecnico}
                        onChange={(e) => setTecnico(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-400 dark:border-white/10 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="">Elegir técnico</option>
                        {getOptions("tecnico").map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    {/* Controller */}
                    <div className="space-y-1">
                      <label className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
                        <ShieldCheck className="h-3 w-3 text-purple-600" />
                        Controller
                      </label>
                      <select
                        value={controller}
                        onChange={(e) => setController(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-400 dark:border-white/10 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="">Elegir controller</option>
                        {getOptions("controller").map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    {/* Lavador */}
                    <div className="space-y-1">
                      <label className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
                        <Droplets className="h-3 w-3 text-cyan-600" />
                        Lavador <span className="lowercase font-medium text-slate-400">(opcional)</span>
                      </label>
                      <select
                        value={lavador}
                        onChange={(e) => setLavador(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-400 dark:border-white/10 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="">Sin lavado / No se lavó</option>
                        {getOptions("lavador").map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    {/* Repuestos */}
                    <div className="space-y-1">
                      <label className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
                        <PackageCheck className="h-3 w-3 text-amber-600" />
                        Repuestos
                      </label>
                      <select
                        value={repuestos}
                        onChange={(e) => setRepuestos(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-400 dark:border-white/10 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="">Elegir repuestos</option>
                        {getOptions("repuestos").map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-white/5 dark:bg-slate-950/20">
              <Button variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white font-black">
                Guardar cambios
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
