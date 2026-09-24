import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  MessageSquare, 
  Camera, 
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAudit } from '../../contexts/AuditContext';
import { Button } from '../ui/Button';

interface AuditReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const AuditReviewModal: React.FC<AuditReviewModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const { session, compliance, isValid, errors, isSending } = useAudit();
  
  const fails = (session.items || []).filter(i => i.status === 'fail');
  const totalItems = (session.items || []).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-6">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 mb-1">Revisión Final</p>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">Resumen de Auditoría</h2>
              </div>
              <button 
                onClick={onClose}
                className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
              
              {/* Compliance Score Hero */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 rounded-3xl bg-slate-900 text-white border border-white/10 flex flex-col justify-between h-40">
                  <div className="flex justify-between items-start">
                    <ShieldCheck className="h-6 w-6 text-blue-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Cumplimiento</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-black italic">{compliance}%</span>
                    <span className={cn(
                      "text-[10px] font-black uppercase px-2 py-1 rounded-lg mb-2",
                      compliance >= 90 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                    )}>
                      {compliance >= 90 ? "Excelente" : "Requiere Acción"}
                    </span>
                  </div>
                </div>

                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 flex flex-col justify-between h-40">
                  <div className="flex justify-between items-start">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Items</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-black italic dark:text-white">{totalItems}</span>
                    <span className="text-[10px] font-black uppercase text-slate-500 mb-2">Evaluados</span>
                  </div>
                </div>
              </div>

              {/* Validation Errors */}
              {!isValid && (
                <div className="p-6 rounded-3xl bg-red-500/10 border border-red-500/20 space-y-4">
                  <div className="flex items-center gap-3 text-red-500">
                    <AlertTriangle className="h-6 w-6" />
                    <h3 className="text-sm font-black uppercase tracking-widest">Bloqueos Detectados</h3>
                  </div>
                  <ul className="space-y-2">
                    {errors.map((error, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs font-bold text-red-700 dark:text-red-400">
                        <div className="h-1 w-1 rounded-full bg-red-500" />
                        {error}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] font-medium text-red-500 italic">Debe corregir estos puntos para poder sincronizar.</p>
                </div>
              )}

              {/* Fails Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Desvíos Detectados ({fails.length})</h3>
                  {fails.length === 0 && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                </div>

                <div className="space-y-3">
                  {fails.length > 0 ? fails.map((fail, i) => (
                    <div key={i} className="p-5 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 space-y-3">
                      <div className="flex items-start gap-4">
                        <div className="h-8 w-8 rounded-xl bg-red-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-red-500/20">
                          <AlertCircle className="h-5 w-5" />
                        </div>
                        <p className="text-[13px] font-bold text-slate-900 dark:text-white leading-tight">{fail.question}</p>
                      </div>
                      
                      <div className="flex gap-4 ml-12">
                        {fail.comment && (
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                            <MessageSquare className="h-3.5 w-3.5" />
                            {fail.comment}
                          </div>
                        )}
                        {fail.photoUrl && (
                          <div className="flex items-center gap-2 text-[10px] font-bold text-blue-500">
                            <Camera className="h-3.5 w-3.5" />
                            Foto adjunta
                          </div>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="py-12 text-center bg-emerald-500/5 rounded-[2.5rem] border border-dashed border-emerald-500/20">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                      <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Sin desvíos detectados</p>
                      <p className="text-[10px] text-emerald-600/60 font-medium mt-1">Cumplimiento perfecto en esta sesión.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 flex gap-4">
              <Button 
                onClick={onClose}
                variant="secondary"
                className="flex-1 h-14 rounded-2xl border-slate-200 dark:border-white/10 text-xs font-black uppercase tracking-widest"
              >
                Volver a Editar
              </Button>
              <Button 
                onClick={onConfirm}
                disabled={!isValid || isSending}
                className={cn(
                  "flex-1 h-14 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2",
                  isValid ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-blue-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                )}
              >
                {isSending ? (
                  <div className="h-5 w-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Confirmar y Enviar</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
