import { AnimatePresence, motion } from "motion/react";

import { AuditSession } from "../../types";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";

interface HistoryAuditDetailModalProps {
  audit: AuditSession | null;
  isOpen: boolean;
  onClose: () => void;
}

export function HistoryAuditDetailModal({ audit, isOpen, onClose }: HistoryAuditDetailModalProps) {
  return (
    <AnimatePresence>
      {isOpen && audit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
            className="relative flex max-h-[84vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2.2rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.95))] shadow-[0_28px_72px_rgba(15,23,42,0.16)]"
          >
            <div className="border-b border-slate-200 px-6 py-5 md:px-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Detalle</p>
                  <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">Detalle de auditor?a</h3>
                  <p className="mt-2 text-sm font-bold text-slate-500">
                    {(audit.role || audit.items[0]?.category || "General")} ? {audit.date}
                  </p>
                </div>
                <div
                  className={cn(
                    "inline-flex items-center rounded-2xl px-4 py-3 text-lg font-black",
                    audit.totalScore >= 90
                      ? "bg-emerald-50 text-emerald-700"
                      : audit.totalScore >= 70
                        ? "bg-amber-50 text-amber-700"
                        : "bg-red-50 text-red-700",
                  )}
                >
                  {audit.totalScore}%
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5 md:px-8">
              <div className="grid grid-cols-1 gap-4 rounded-[1.6rem] border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Personal</p>
                  <p className="mt-2 text-sm font-bold text-slate-800">{audit.staffName || "Sin asignar"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Ubicaci?n</p>
                  <p className="mt-2 text-sm font-bold text-slate-800">{audit.location}</p>
                </div>
                {audit.orderNumber && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">N?mero de OR</p>
                    <p className="mt-2 text-sm font-bold text-blue-700">{audit.orderNumber}</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Resultados por ?tem</p>
                {audit.items.map((item) => (
                  <article key={item.id} className="rounded-[1.3rem] border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <p className="text-sm font-bold leading-relaxed text-slate-800">{item.question}</p>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                          item.status === "pass"
                            ? "bg-emerald-100 text-emerald-700"
                            : item.status === "fail"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {item.status === "pass" ? "Cumple" : item.status === "fail" ? "No cumple" : "N/A"}
                      </span>
                    </div>
                    {item.comment && (
                      <p className="mt-2 text-xs font-medium italic leading-relaxed text-slate-500">"{item.comment}"</p>
                    )}
                  </article>
                ))}
              </div>

              {audit.notes && (
                <div className="rounded-[1.6rem] border border-blue-100 bg-blue-50/80 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-500">Notas generales</p>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-blue-900">{audit.notes}</p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 px-6 py-4 md:px-8">
              <Button className="w-full" onClick={onClose}>
                Cerrar
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

