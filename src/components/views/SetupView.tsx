import { ArrowLeft, Check, ChevronRight, MapPin, User } from "lucide-react";

import { cn } from "../../lib/utils";
import { Auditor, Location } from "../../types";

interface SetupViewProps {
  dateLabel?: string;
  auditors: Auditor[];
  locations: readonly Location[];
  selectedAuditorId?: string;
  selectedLocation?: Location;
  auditBatchDisplayName?: string;
  onSelectAuditor: (auditorId: string) => void;
  onSelectLocation: (location: Location) => void;
  onCancel: () => void;
  onContinue: () => void;
}

export function SetupView({
  dateLabel,
  auditors,
  locations,
  selectedAuditorId,
  selectedLocation,
  auditBatchDisplayName,
  onSelectAuditor,
  onSelectLocation,
  onCancel,
  onContinue,
}: SetupViewProps) {
  const canContinue = Boolean(selectedAuditorId && selectedLocation);

  return (
    <div className="setup-shell">
      <section className="setup-hero">
        <div className="setup-hero-copy">
          <p className="setup-kicker">Setup</p>
          <h2 className="setup-title">Configura la auditoría.</h2>
          <p className="setup-description">Auditor y sucursal.</p>
        </div>
        <div className="setup-meta-grid">
          <div className="setup-meta-card">
            <p className="setup-meta-label">Fecha</p>
            <p className="setup-meta-value">{dateLabel || "Sin definir"}</p>
          </div>
          <div className="setup-meta-card">
            <p className="setup-meta-label">Estado</p>
            <p className="setup-meta-value">{canContinue ? "Listo" : "Pendiente"}</p>
          </div>
        </div>
      </section>

      <section className="setup-panel">
        <div className="setup-grid">
          <div className="setup-column">
            <div className="setup-column-header">
              <p className="setup-kicker">Auditor</p>
              <h3 className="setup-section-title">Seleccion</h3>
            </div>
            <div className="grid gap-3">
              {auditors.map((auditor) => {
                const isActive = selectedAuditorId === auditor.id;

                return (
                  <button
                    key={auditor.id}
                    onClick={() => onSelectAuditor(auditor.id)}
                    className={cn("setup-option-card", isActive && "is-active")}
                  >
                    <div className="setup-option-main">
                      <div className={cn("setup-option-icon", isActive && "is-active")}>
                        <User className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="setup-option-title">{auditor.name}</p>
                        <p className="setup-option-subtitle">Auditor</p>
                      </div>
                    </div>
                    {isActive && <Check className="h-5 w-5" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="setup-column">
            <div className="setup-column-header">
              <p className="setup-kicker">Sucursal</p>
              <h3 className="setup-section-title">Seleccion</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {locations.map((location) => {
                const isActive = selectedLocation === location;

                return (
                  <button
                    key={location}
                    onClick={() => onSelectLocation(location)}
                    className={cn("setup-option-card", isActive && "is-active")}
                  >
                    <div className="setup-option-main">
                      <div className={cn("setup-option-icon", isActive && "is-active")}>
                        <MapPin className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="setup-option-title">{location}</p>
                        <p className="setup-option-subtitle">Sucursal</p>
                      </div>
                    </div>
                    {isActive && <Check className="h-5 w-5" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="setup-footer">
          <div className="setup-batch-card">
            <p className="setup-meta-label">Auditoria</p>
            <p className="setup-batch-value">{selectedLocation ? auditBatchDisplayName || "Automática" : "Selecciona una sucursal"}</p>
          </div>

          <div className="setup-actions">
            <button onClick={onCancel} className="setup-secondary-button">
              <ArrowLeft className="h-4 w-4" />
              Cancelar
            </button>

            <button onClick={onContinue} disabled={!canContinue} className="setup-primary-button">
              Continuar
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
