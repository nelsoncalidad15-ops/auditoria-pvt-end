import { AlertTriangle, CheckCircle2, Download, FileCheck } from "lucide-react";
import { motion } from "motion/react";

import { OR_ROLE_LABELS } from "../../constants";
import { cn } from "../../lib/utils";
import { CompletedAuditReport } from "../../types";
import { Button } from "../ui/Button";

interface AuditResultSummaryProps {
  report: CompletedAuditReport;
  onDownload: () => void;
  onClose: () => void;
}

export function AuditResultSummary({ report, onDownload, onClose }: AuditResultSummaryProps) {
  const session = report.session;
  const deviations = session.items.filter((item) => item.status === "fail");
  const roleScores = session.roleScores || [];
  const participants = session.participants || {};
  const scoreTone = session.totalScore >= 90
    ? "bg-emerald-500"
    : session.totalScore >= 70 ? "bg-amber-500" : "bg-rose-500";
  const getParticipantName = (role: typeof roleScores[number]["role"]) => ({
    asesor: participants.asesorServicio,
    tecnico: participants.tecnico,
    controller: participants.controller,
    lavador: participants.lavador,
    repuestos: participants.repuestos,
  })[role]?.trim() || "Sin asignar";

  return (
    <motion.div initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} className="my-auto w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl dark:bg-slate-900">
      <header className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/10 sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white"><FileCheck className="h-6 w-6" /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Auditoría guardada</p>
            <h3 className="truncate text-lg font-black text-slate-950 dark:text-white sm:text-xl">{session.orderNumber ? `OR ${session.orderNumber}` : session.role || "Resultado"}</h3>
          </div>
        </div>
        <div className={cn("flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl text-white", scoreTone)}>
          <span className="text-[8px] font-black uppercase tracking-wider opacity-80">Total</span><span className="text-2xl font-black">{session.totalScore}%</span>
        </div>
      </header>

      <div className="max-h-[68vh] space-y-5 overflow-y-auto p-5 sm:p-7">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric label="Evaluados" value={session.items.filter((item) => item.status !== "na").length} />
          <Metric label="Desvíos" value={deviations.length} alert={deviations.length > 0} />
          <div className="col-span-2 rounded-2xl bg-blue-50 p-4 sm:col-span-1 dark:bg-blue-950/20">
            <p className="text-[9px] font-black uppercase tracking-wider text-blue-500">Responsable principal</p>
            <p className="mt-1 truncate text-sm font-black text-blue-900 dark:text-blue-200">{session.staffName || "Sin asignar"}</p>
          </div>
        </div>

        {roleScores.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Impacto por área</p>
              <p className="text-[9px] font-bold text-slate-400">Verde 90+ · Amarillo 70–89</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {roleScores.map((score) => {
                const barTone = score.compliance >= 90 ? "bg-emerald-500" : score.compliance >= 70 ? "bg-amber-500" : "bg-rose-500";
                return (
                  <div key={score.role} className="rounded-2xl border border-slate-100 p-3.5 dark:border-white/10">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0"><p className="text-xs font-black text-slate-800 dark:text-slate-100">{OR_ROLE_LABELS[score.role]}</p><p className="truncate text-[10px] font-semibold text-slate-400">{getParticipantName(score.role)} · {score.itemsCount} controles</p></div>
                      <span className="text-lg font-black text-slate-900 dark:text-white">{score.compliance}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={cn("h-full rounded-full", barTone)} style={{ width: `${score.compliance}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className={cn("rounded-2xl border p-4", deviations.length ? "border-rose-100 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20" : "border-emerald-100 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20")}>
          <div className="flex items-center gap-2">{deviations.length ? <AlertTriangle className="h-4 w-4 text-rose-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}<p className={cn("text-[10px] font-black uppercase tracking-[0.16em]", deviations.length ? "text-rose-700" : "text-emerald-700")}>{deviations.length ? "Prioridades de corrección" : "Sin desvíos detectados"}</p></div>
          {deviations.length > 0 && <div className="mt-3 space-y-2">{deviations.slice(0, 3).map((item, index) => <div key={item.id || index} className="flex gap-2 text-xs font-semibold leading-snug text-slate-700 dark:text-slate-200"><span className="font-black text-rose-500">{index + 1}.</span><span>{item.question}</span></div>)}{deviations.length > 3 && <p className="text-[10px] font-black text-rose-500">+{deviations.length - 3} desvíos adicionales en el PDF</p>}</div>}
        </section>
      </div>

      <footer className="grid gap-3 border-t border-slate-100 p-5 dark:border-white/10 sm:grid-cols-2 sm:px-7">
        <Button variant="secondary" className="h-14 rounded-2xl text-xs font-black uppercase tracking-widest" onClick={onDownload}><Download className="mr-2 h-4 w-4" />Descargar PDF</Button>
        <Button className="h-14 rounded-2xl text-xs font-black uppercase tracking-widest" onClick={onClose}>Listo</Button>
      </footer>
    </motion.div>
  );
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return <div className={cn("rounded-2xl p-4", alert ? "bg-rose-50 dark:bg-rose-950/20" : "bg-slate-50 dark:bg-slate-950/50")}><p className={cn("text-[9px] font-black uppercase tracking-wider", alert ? "text-rose-500" : "text-slate-400")}>{label}</p><p className={cn("mt-1 text-2xl font-black", alert ? "text-rose-700 dark:text-rose-300" : "text-slate-900 dark:text-white")}>{value}</p></div>;
}
