import { XCircle, FileText } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { AuditSession, AuditTemplateItem, Role } from "../../types";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";

interface CompletedAuditReport {
  role: Role;
  session: AuditSession;
  auditorName: string;
  templateItems: AuditTemplateItem[];
}

interface SectionScore {
  sectionName: string;
  score: number;
  passCount: number;
  failCount: number;
  naCount: number;
  pendingCount: number;
}

interface BatchReportModalProps {
  isOpen: boolean;
  reports: CompletedAuditReport[];
  appTitle: string;
  onClose: () => void;
  getSectionScores: (templateItems: AuditTemplateItem[], session: AuditSession) => SectionScore[];
  getAuditItemStatusLabel: (status: AuditSession["items"][number]["status"]) => string;
}

export function BatchReportModal({
  isOpen,
  reports,
  appTitle,
  onClose,
  getSectionScores,
  getAuditItemStatusLabel,
}: BatchReportModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            className="panel-premium relative flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2.3rem]"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5 md:px-8">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Reporte</p>
                <h3 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">Puntajes detallados</h3>
              </div>
              <button
                onClick={onClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition-all hover:border-slate-300 hover:text-slate-900"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 md:px-8">
              {reports.map((report) => {
                const sectionScores = getSectionScores(report.templateItems, report.session);

                return (
                  <div key={`${report.role}-${report.session.id}`} className="rounded-[1.9rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{report.session.location}</p>
                        <h4 className="mt-2 text-xl font-black text-slate-950">{report.role}</h4>
                        <p className="mt-1 text-sm font-bold text-slate-500">{report.session.staffName || report.auditorName} ? {report.session.date}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-center text-emerald-700">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em]">Score</p>
                          <p className="mt-1 text-xl font-black">{report.session.totalScore}%</p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={async () => {
                            const { generateAuditPdfReport } = await import("../../services/audit-report-pdf");
                            await generateAuditPdfReport({
                              appTitle,
                              session: report.session,
                              auditorName: report.auditorName,
                              templateItems: report.templateItems,
                            });
                          }}
                        >
                          <FileText className="h-4 w-4" />
                          PDF
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
                      {sectionScores.map((section) => (
                        <div key={section.sectionName} className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{section.sectionName}</p>
                          <p className="mt-2 text-lg font-black text-slate-950">{section.score}%</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                            <span>{section.passCount} ok</span>
                            <span>{section.failCount} fail</span>
                            <span>{section.naCount} n/a</span>
                            <span>{section.pendingCount} pend.</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 space-y-2">
                      {report.session.items.map((item) => (
                        <div key={item.id} className="rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <p className="text-sm font-bold text-slate-800">{item.question}</p>
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
                              {getAuditItemStatusLabel(item.status)}
                            </span>
                          </div>
                          {item.comment && (
                            <p className="mt-2 text-xs font-medium text-slate-500">{item.comment}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
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

