import { AlertTriangle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "../ui/Button";

interface DeleteAuditModalProps {
  isOpen: boolean;
  auditName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteAuditModal({ isOpen, auditName, onClose, onConfirm }: DeleteAuditModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            className="relative w-full max-w-md space-y-6 rounded-[2rem] border border-red-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.95))] p-8 shadow-[0_28px_72px_rgba(15,23,42,0.16)]"
          >
            <div className="space-y-4">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-red-50 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-500">Acción sensible</p>
                <h3 className="text-2xl font-black tracking-[-0.04em] text-slate-950">Eliminar auditoría</h3>
                <p className="text-sm font-medium leading-relaxed text-slate-500">
                  Esta acción quita el borrador de forma permanente del dispositivo actual.
                </p>
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-red-100 bg-red-50/80 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-600">Auditoría seleccionada</p>
              <p className="mt-2 text-sm font-bold leading-relaxed text-red-950 break-words">{auditName}</p>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={onClose}>
                Cancelar
              </Button>
              <Button variant="danger" className="flex-1" onClick={onConfirm}>
                Eliminar
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
