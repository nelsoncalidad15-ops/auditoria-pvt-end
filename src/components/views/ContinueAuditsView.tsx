import { Activity, ClipboardCheck, Play, Trash2 } from "lucide-react";
import { motion } from "motion/react";

import { cn } from "../../lib/utils";
import { IncompleteAuditListItem } from "../../types";

interface ContinueAuditsViewProps {
  audits: IncompleteAuditListItem[];
  onResume: (audit: IncompleteAuditListItem) => void;
  onDelete: (audit: IncompleteAuditListItem) => void;
}

function formatAuditProgress(audit: IncompleteAuditListItem) {
  const totalItems = audit.items?.length || 0;
  const completedItems = audit.items?.filter((item) => item.status).length || 0;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const isFromHistory = audit._source === "history";

  return {
    totalItems,
    completedItems,
    progressPercent,
    isFromHistory,
    badgeLabel: isFromHistory ? "Sistema" : "Borrador",
    scoreLabel: isFromHistory ? `${audit.totalScore ?? 0}%` : `${progressPercent}%`,
  };
}

export function ContinueAuditsView({ audits, onResume, onDelete }: ContinueAuditsViewProps) {
  return (
    <div className="space-y-6 pt-4">
      <div className="flex flex-col gap-3 rounded-[2.2rem] border border-white/80 bg-white/80 p-6 shadow-sm backdrop-blur md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Continuidad operativa</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Continuar auditoria</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">Retoma borradores o evaluaciones incompletas sin perder trazabilidad.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:w-[320px]">
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pendientes</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{audits.length}</p>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cobertura</p>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {audits.length > 0
                ? `${Math.round(audits.reduce((acc, audit) => acc + formatAuditProgress(audit).progressPercent, 0) / audits.length)}%`
                : "0%"}
            </p>
          </div>
        </div>
      </div>

      {audits.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {audits.map((audit) => {
            const progress = formatAuditProgress(audit);
            const displayRole = audit.role || audit.items?.[0]?.category || "General";

            return (
              <button
                key={`draft-card-${audit.id}`}
                onClick={() => onResume(audit)}
                className="group relative space-y-3 rounded-[1.8rem] border border-slate-200 bg-white p-5 text-left transition-all hover:border-blue-300 hover:shadow-lg active:scale-95"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-900 break-words">{audit.auditBatchName || "Auditoria sin nombre"}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{progress.badgeLabel} · {audit.date}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(audit);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-100 transition-colors hover:bg-red-200"
                      title="Eliminar auditoria"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 transition-colors group-hover:bg-blue-200">
                      <Play className="h-4 w-4 text-blue-600 transition-transform group-hover:scale-110" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border-t border-slate-100 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">Progreso</span>
                    <span className="text-xs font-black text-blue-600">{progress.completedItems}/{progress.totalItems} items</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress.progressPercent}%` }}
                      transition={{ duration: 0.45, ease: "easeOut" }}
                      className={cn(
                        "h-full transition-colors",
                        progress.progressPercent < 33 ? "bg-red-500" : progress.progressPercent < 66 ? "bg-amber-500" : "bg-emerald-500"
                      )}
                    />
                  </div>
                  <span className="text-xs font-black text-slate-600">{progress.scoreLabel}</span>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600">Auditor</span>
                    <span className="text-right font-bold text-slate-900 break-words">{audit.auditorId || "-"}</span>
                  </div>
                  {audit.location && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-600">Ubicacion</span>
                      <span className="font-bold text-slate-900">{audit.location}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600">Categoria</span>
                    <span className="font-bold text-slate-900">{displayRole}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3 rounded-[1.8rem] border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200">
            <ClipboardCheck className="h-8 w-8 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-600">No hay auditorias incompletas</p>
            <p className="mt-1 text-xs font-bold text-slate-500">Todas las evaluaciones disponibles ya estan cerradas o sincronizadas.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            <Activity className="h-3.5 w-3.5" />
            Operacion al dia
          </div>
        </div>
      )}
    </div>
  );
}
