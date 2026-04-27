import { AlertCircle, ChevronRight, ClipboardCheck, Clock, Plus, Activity, Zap } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";
import { Skeleton } from "../common/Skeleton";
import { AuditSession } from "../../types";

type QuickActionTone = "primary" | "neutral" | "accent" | "outline" | "disabled";

interface QuickAction {
  label: string;
  description: string;
  onClick: () => void;
  tone: QuickActionTone;
  disabled?: boolean;
}

interface HomeViewProps {
  isLoggingIn: boolean;
  isSyncing: boolean;
  isSheetSyncConfigured: boolean;
  isHistorySyncConfigured: boolean;
  historySyncModeLabel: string;
  hasWebhookUrl: boolean;
  hasSheetCsvUrl: boolean;
  isUsingExternalHistory: boolean;
  isFirebaseEnabled: boolean;
  hasUser: boolean;
  localAuditHistoryCount: number;
  historyCount: number;
  recentAudits: AuditSession[];
  onStartAudit: () => void;
  onSyncData: () => void;
  onOpenHistory: () => void;
  onOpenSetup: () => void;
  onOpenStructure: () => void;
  onOpenContinue: () => void;
  canOpenStructure: boolean;
  canOpenContinue: boolean;
}

export function HomeView({
  isLoggingIn,
  isSyncing,
  isSheetSyncConfigured,
  isHistorySyncConfigured,
  historySyncModeLabel,
  hasWebhookUrl,
  hasSheetCsvUrl,
  isUsingExternalHistory,
  isFirebaseEnabled,
  hasUser,
  localAuditHistoryCount,
  historyCount,
  recentAudits,
  onStartAudit,
  onSyncData,
  onOpenHistory,
  onOpenSetup,
  onOpenStructure,
  onOpenContinue,
  canOpenStructure,
  canOpenContinue,
}: HomeViewProps) {
  const quickActions = [
    {
      label: "Iniciar auditoría",
      description: "Abrir la carga de una nueva auditoría.",
      onClick: onStartAudit,
      tone: "primary",
    },
    {
      label: "Configurar",
      description: "Elegir auditor y sucursal antes de empezar.",
      onClick: onOpenSetup,
      tone: "neutral",
    },
    {
      label: "Continuar",
      description: "Retomar un borrador guardado.",
      onClick: onOpenContinue,
      tone: canOpenContinue ? "accent" : "disabled",
      disabled: !canOpenContinue,
    },
    {
      label: "Estructura",
      description: "Editar preguntas, vínculos y pesos.",
      onClick: onOpenStructure,
      tone: canOpenStructure ? "outline" : "disabled",
      disabled: !canOpenStructure,
    },
  ] satisfies QuickAction[];

  const operationalCards = [
    {
      label: "Apps Script",
      status: isSheetSyncConfigured ? "Activo" : "Pendiente",
      description: isSheetSyncConfigured ? "Las auditorias pueden enviarse al endpoint configurado." : "Falta definir la URL de recepcion para enviar auditorias.",
      accentClass: isSheetSyncConfigured ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-amber-500/10 border-amber-500/20 text-amber-500",
      icon: ClipboardCheck,
    },
    {
      label: "Historial externo",
      status: historySyncModeLabel,
      description: hasWebhookUrl ? "El historial puede importarse completo desde Apps Script y Google Sheets." : hasSheetCsvUrl ? "Hay una fuente CSV de respaldo configurada para validacion externa." : "Define un Apps Script o una URL CSV publicada para refrescar reportes.",
      accentClass: isHistorySyncConfigured ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-amber-500/10 border-amber-500/20 text-amber-500",
      icon: Clock,
    },
    {
      label: "Acceso",
      status: isFirebaseEnabled ? (hasUser ? "Autenticado" : "Invitado") : "Sheets only",
      description: isUsingExternalHistory
        ? "Se esta usando historial importado desde Google Sheets."
        : hasUser && isFirebaseEnabled
          ? "Hay acceso a historial y persistencia en Firestore."
          : localAuditHistoryCount > 0
            ? "Hay historial guardado en este dispositivo."
            : isFirebaseEnabled
              ? "Los datos nuevos se guardaran en este dispositivo hasta iniciar sesion."
              : "La operacion esta centrada en Apps Script, Google Sheets y almacenamiento local.",
      accentClass: hasUser ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-slate-500/10 border-slate-500/20 text-slate-500",
      icon: AlertCircle,
    },
  ];

  return (
    <div className="space-y-10 pb-10">
      <section className="relative overflow-hidden rounded-[3rem] bg-slate-950 p-10 md:p-16 text-white shadow-2xl border border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.2),transparent_50%)]" />
        <div className="absolute bottom-0 right-0 p-12 opacity-5 pointer-events-none">
           <Activity className="w-80 h-80 rotate-12" />
        </div>
        
        <div className="relative z-10 flex flex-col lg:flex-row gap-16 items-center justify-between">
          <div className="flex-1 space-y-10">
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-500/10 border border-blue-500/20 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.25em] text-blue-400 backdrop-blur-xl"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              SISTEMA OPERATIVO PVT
            </motion.div>

            <div className="space-y-6">
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-5xl md:text-7xl font-black leading-[0.95] tracking-tighter"
              >
                Excelencia <br /> <span className="text-blue-500">Operacional.</span>
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="max-w-lg text-lg md:text-xl font-medium text-slate-400 leading-relaxed"
              >
                Monitoreo estratégico y auditoría técnica para la red de sucursales Autosol.
              </motion.p>
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <button
                onClick={onStartAudit}
                disabled={isLoggingIn}
                className={cn(
                  "flex items-center justify-center gap-3 h-16 px-12 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-2xl active:scale-95 group",
                  "bg-white text-slate-950 hover:bg-blue-50 dark:hover:bg-slate-200",
                  isLoggingIn && "cursor-not-allowed opacity-70"
                )}
              >
                <Plus className="h-5 w-5 transition-transform group-hover:rotate-90" />
                Nueva Auditoría
              </button>

              <button 
                onClick={onSyncData} 
                disabled={isSyncing} 
                className="flex items-center justify-center gap-3 h-16 px-12 rounded-2xl font-black text-xs uppercase tracking-widest bg-white/5 hover:bg-white/10 text-white backdrop-blur-xl border border-white/10 transition-all active:scale-95"
              >
                <div className={cn("h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin", !isSyncing && "hidden")} />
                {!isSyncing && <Zap className="h-5 w-5 text-amber-400" />}
                {isSyncing ? "Sincronizando..." : "Refrescar Datos"}
              </button>
            </motion.div>
          </div>

          <div className="w-full lg:w-auto grid grid-cols-2 lg:grid-cols-1 gap-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="p-10 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-3xl flex flex-col items-center lg:items-start"
            >
              <div className="flex items-center gap-3 mb-4">
                 <div className="h-8 w-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-500">
                    <Clock className="w-4 h-4" />
                 </div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Historial</p>
              </div>
              {isSyncing ? <Skeleton className="h-16 w-32" /> : <p className="text-6xl font-black tracking-tighter">{historyCount}</p>}
              <p className="text-[10px] font-bold text-slate-400 mt-3 uppercase tracking-widest">Auditorías Totales</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="p-10 rounded-[2.5rem] bg-blue-600/5 border border-blue-500/20 backdrop-blur-3xl flex flex-col items-center lg:items-start"
            >
              <div className="flex items-center gap-3 mb-4">
                 <div className="h-8 w-8 rounded-xl bg-[--accent-neon]/20 flex items-center justify-center text-[--accent-neon]">
                    <Activity className="w-4 h-4" />
                 </div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pendientes</p>
              </div>
              {isSyncing ? <Skeleton className="h-16 w-32" /> : <p className="text-6xl font-black text-[--accent-neon] tracking-tighter">{localAuditHistoryCount}</p>}
              <p className="text-[10px] font-bold text-slate-400 mt-3 uppercase tracking-widest">Cola de Envío</p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="px-2">
          <p className="text-blue-600 font-black uppercase tracking-[0.2em] text-[10px]">Accesos Directos</p>
          <h3 className="text-3xl font-black tracking-tight mt-1">Operaciones</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action, index) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className={cn(
                "group relative flex flex-col items-start p-8 rounded-[2.5rem] transition-all active:scale-95 text-left border",
                action.tone === "primary" ? "bg-slate-900 border-slate-900 text-white dark:bg-white dark:text-slate-950" : "bg-white border-slate-100 dark:bg-slate-900 dark:border-slate-800",
                action.disabled && "opacity-50 grayscale cursor-not-allowed"
              )}
            >
              <div className="flex w-full items-center justify-between mb-6">
                <div className={cn(
                   "h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-6",
                   action.tone === "primary" ? "bg-white/10 dark:bg-slate-100" : "bg-slate-50 dark:bg-slate-800"
                )}>
                   <Activity className="w-5 h-5" />
                </div>
                <ChevronRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
              </div>
              <p className="text-xl font-black leading-tight uppercase italic">{action.label}</p>
              <p className="mt-3 text-sm font-medium opacity-60 leading-relaxed">{action.description}</p>
            </motion.button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {operationalCards.map((card, index) => (
            <motion.article 
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 + index * 0.1 }}
              className={cn("p-8 rounded-[2.5rem] border bg-white dark:bg-slate-900 flex flex-col justify-between h-full border-slate-100 dark:border-slate-800 shadow-sm")}
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm", card.accentClass)}>
                    <card.icon className="h-6 w-6" />
                  </div>
                  <span className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full", card.accentClass)}>
                    {card.status}
                  </span>
                </div>
                <div>
                  <h4 className="text-lg font-black uppercase tracking-tight">{card.label}</h4>
                  <p className="mt-2 text-xs font-medium text-slate-500 leading-relaxed">{card.description}</p>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.3 }}
          className="p-8 rounded-[2.5rem] bg-[--accent-neon] text-[#050a14] flex flex-col justify-between shadow-xl shadow-[--accent-neon-glow]"
        >
          <div className="space-y-1">
             <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Sincronización</p>
             <h3 className="text-2xl font-black uppercase italic leading-none">Sistema Listo</h3>
          </div>
          
          <div className="mt-10 grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-4xl font-black tracking-tighter">{hasUser ? "OK" : "!!"}</p>
              <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Usuario</p>
            </div>
            <div className="space-y-1">
              <p className="text-4xl font-black tracking-tighter">{isHistorySyncConfigured ? "ON" : "OFF"}</p>
              <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Nube</p>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div>
            <p className="text-blue-600 font-black uppercase tracking-[0.2em] text-[10px]">Reciente</p>
            <h3 className="text-3xl font-black tracking-tight mt-1">Últimas Auditorías</h3>
          </div>
          <button onClick={onOpenHistory} className="h-10 px-6 rounded-xl border border-slate-200 dark:border-slate-800 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Ver Todo
          </button>
        </div>

        {!hasUser && !isUsingExternalHistory && localAuditHistoryCount === 0 ? (
          <div className="rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-800 py-16 text-center">
            <p className="text-sm font-bold text-slate-400">Sin auditorías registradas.</p>
          </div>
        ) : historyCount === 0 ? (
          <div className="rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-800 py-16 text-center">
            <p className="text-sm font-bold text-slate-400">Sin registros disponibles.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentAudits.map((item, index) => (
              <motion.article 
                key={item.id} 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.5 + index * 0.1 }}
                className="group p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500/50 transition-all flex items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex items-center gap-5">
                  <div
                    className={cn(
                      "h-14 w-14 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm transition-transform group-hover:scale-110",
                      item.totalScore >= 90 ? "bg-emerald-500 text-white" : item.totalScore >= 70 ? "bg-amber-500 text-white" : "bg-red-500 text-white"
                    )}
                  >
                    {item.totalScore}%
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{item.location}</p>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.date}</span>
                       <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest opacity-80">? {item.items.length} Items</span>
                    </div>
                  </div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
