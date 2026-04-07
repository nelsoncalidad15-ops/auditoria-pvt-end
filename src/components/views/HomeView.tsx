import { AlertCircle, ChevronRight, ClipboardCheck, Clock, Plus } from "lucide-react";

import { cn } from "../../lib/utils";
import { AuditSession } from "../../types";

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
}: HomeViewProps) {
  const operationalCards = [
    {
      label: "Apps Script",
      status: isSheetSyncConfigured ? "Activo" : "Pendiente",
      description: isSheetSyncConfigured ? "Las auditorias pueden enviarse al endpoint configurado." : "Falta definir la URL de recepcion para enviar auditorias.",
      accentClass: isSheetSyncConfigured ? "is-success" : "is-warning",
      icon: ClipboardCheck,
    },
    {
      label: "Historial externo",
      status: historySyncModeLabel,
      description: hasWebhookUrl ? "El historial puede importarse completo desde Apps Script y Google Sheets." : hasSheetCsvUrl ? "Hay una fuente CSV de respaldo configurada para validacion externa." : "Define un Apps Script o una URL CSV publicada para refrescar reportes.",
      accentClass: isHistorySyncConfigured ? "is-success" : "is-warning",
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
      accentClass: hasUser ? "is-success" : "is-neutral",
      icon: AlertCircle,
    },
  ];

  return (
    <div className="space-y-7">
      <section className="home-hero-card">
        <div className="home-hero-noise" />
        <div className="home-hero-grid">
          <div className="space-y-5">
            <div className="home-hero-badge">
              <span className="home-hero-badge-dot" />
              Inicio
            </div>

            <div className="space-y-3">
              <div className="home-hero-logo">
                <ClipboardCheck className="h-10 w-10 text-white" />
              </div>
              <div className="space-y-2">
                <h2 className="home-hero-title">Cabina de auditoria</h2>
                <p className="home-hero-copy">Todo en un solo lugar.</p>
              </div>
            </div>

            <div className="home-hero-actions">
              <button
                onClick={onStartAudit}
                disabled={isLoggingIn}
                className={cn("home-primary-button", isLoggingIn && "cursor-not-allowed opacity-70")}
              >
                <Plus className="h-5 w-5" />
                Iniciar ahora
              </button>

              <button onClick={onSyncData} disabled={isSyncing} className="home-secondary-button">
                <div className={cn("h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin", !isSyncing && "hidden")} />
                {isSyncing ? "Sincronizando..." : "Sincronizar datos"}
              </button>
            </div>
          </div>

          <div className="home-hero-side">
            <div className="home-metric-card">
              <p className="home-metric-label">Historial cargado</p>
              <p className="home-metric-value">{historyCount}</p>
              <p className="home-metric-copy">registros</p>
            </div>
            <div className="home-metric-card">
              <p className="home-metric-label">Pendiente local</p>
              <p className="home-metric-value">{localAuditHistoryCount}</p>
              <p className="home-metric-copy">pendientes</p>
            </div>
            <div className="home-metric-card">
              <p className="home-metric-label">Modo operativo</p>
              <p className="home-metric-value home-metric-value--small">{historySyncModeLabel}</p>
              <p className="home-metric-copy">activo</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {operationalCards.map((card) => (
            <article key={card.label} className={cn("home-status-card", card.accentClass)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="home-status-label">{card.label}</p>
                  <p className="home-status-value">{card.status}</p>
                </div>
                <div className="home-status-icon">
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
              <p className="home-status-copy">{card.description}</p>
            </article>
          ))}
        </div>

        <div className="home-overview-panel">
          <p className="home-overview-label">Estado</p>
          <h3 className="home-overview-title">Operacion lista</h3>
          <div className="home-overview-grid">
            <div>
              <span className="home-overview-metric">{hasUser ? "OK" : "WAIT"}</span>
              <p className="home-overview-metric-copy">acceso</p>
            </div>
            <div>
              <span className="home-overview-metric">{isHistorySyncConfigured ? "SYNC" : "SETUP"}</span>
              <p className="home-overview-metric-copy">sync</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <div>
            <p className="home-section-kicker">Actividad</p>
            <h3 className="home-section-title">Historial reciente</h3>
          </div>
          <button onClick={onOpenHistory} className="home-link-button">
            Ver todo
          </button>
        </div>

        {!hasUser && !isUsingExternalHistory && localAuditHistoryCount === 0 ? (
          <div className="home-empty-panel">
            <p className="text-sm italic text-gray-400">Sin auditorias.</p>
          </div>
        ) : historyCount === 0 ? (
          <div className="home-empty-panel">
            <p className="text-sm text-gray-400">Sin registros.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentAudits.map((item) => (
              <article key={item.id} className="home-history-card">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "home-history-score",
                      item.totalScore >= 90 ? "bg-green-50 text-green-600" : item.totalScore >= 70 ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-600"
                    )}
                  >
                    {item.totalScore}%
                  </div>
                  <div>
                    <p className="text-sm font-bold">{item.location} - {item.date}</p>
                    <p className="text-xs text-gray-500">{item.items.length} items</p>
                  </div>
                </div>
                <div className="home-history-arrow">
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
