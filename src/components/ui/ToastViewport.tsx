import React from "react";
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "../../lib/utils";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone?: ToastTone;
}

interface ToastViewportProps {
  toasts: ToastItem[];
  onDismiss: (toastId: string) => void;
}

const TOAST_STYLES: Record<ToastTone, { icon: React.ComponentType<{ className?: string }>; className: string }> = {
  success: {
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50/95 text-emerald-900",
  },
  error: {
    icon: AlertCircle,
    className: "border-red-200 bg-red-50/95 text-red-900",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-amber-200 bg-amber-50/95 text-amber-950",
  },
  info: {
    icon: Info,
    className: "border-blue-200 bg-blue-50/95 text-slate-900",
  },
};

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (toastId: string) => void;
}) {
  const tone = toast.tone ?? "info";
  const { icon: Icon, className } = TOAST_STYLES[tone];

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onDismiss(toast.id);
    }, 4200);

    return () => window.clearTimeout(timeoutId);
  }, [onDismiss, toast.id]);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: -16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.96 }}
      className={cn(
        "pointer-events-auto w-full rounded-[1.6rem] border px-4 py-4 shadow-[0_18px_44px_rgba(15,23,42,0.12)] backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black tracking-[-0.02em]">{toast.title}</p>
          {toast.description && (
            <p className="mt-1 text-xs font-medium leading-relaxed text-current/75">{toast.description}</p>
          )}
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-current/60 transition-colors hover:bg-white/70 hover:text-current"
          aria-label="Cerrar notificación"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.article>
  );
}

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[130] flex justify-end md:inset-x-6">
      <div className="flex w-full max-w-sm flex-col gap-3">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
