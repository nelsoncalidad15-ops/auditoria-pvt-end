import { ArrowRight, ClipboardCheck, Eye, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { AuditUserProfile } from "../../types";

const PROFILES = [
  { id: "supervisor", label: "Supervisor", icon: ShieldCheck, description: "Gestiona estructura, auditorías y sincronización.", tone: "blue" },
  { id: "auditor", label: "Auditor", icon: ClipboardCheck, description: "Realiza controles y registra hallazgos.", tone: "navy" },
  { id: "consulta", label: "Consulta", icon: Eye, description: "Consulta indicadores, informes e historial.", tone: "green" },
] as const;

interface LoginViewProps {
  appTitle: string;
  isLoggingIn: boolean;
  firebaseEnabled: boolean;
  user: { displayName?: string | null; email?: string | null } | null;
  onSelectProfile: (profile: AuditUserProfile) => void;
  onLogin: () => void;
}

export function LoginView({ isLoggingIn, firebaseEnabled, user, onSelectProfile, onLogin }: LoginViewProps) {
  return (
    <main className="audit-welcome">
      <header className="audit-welcome__header">
        <div className="audit-welcome__brand">
          <img src={`${import.meta.env.BASE_URL}images/autosol-vw-logo.png`} alt="Volkswagen Autosol" />
          <span>Auditoría</span>
        </div>
        <p>Plataforma de control y mejora continua</p>
      </header>

      <section className="audit-welcome__hero">
        <img className="audit-welcome__photo" src={`${import.meta.env.BASE_URL}images/fachada-autosol.png`} alt="Fachada de Autosol Volkswagen" />
        <div className="audit-welcome__shade" />
        <motion.div className="audit-welcome__copy" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}>
          <p className="audit-welcome__eyebrow"><span /> Autosol Volkswagen</p>
          <h1>Control claro.<br /><span>Mejora constante.</span></h1>
          <p className="audit-welcome__intro">Un sistema conectado para auditar procesos, detectar oportunidades y acompañar cada mejora.</p>
          <div className="audit-welcome__status"><i /> Sistema operativo · Acceso seguro</div>
        </motion.div>
        <span className="audit-welcome__caption">Autosol · Volkswagen</span>
      </section>

      <section className="audit-access" aria-labelledby="access-title">
        <div className="audit-access__heading">
          <div><p>Acceso al sistema</p><h2 id="access-title">Elegí tu perfil</h2></div>
          <span>Ingresá según el nivel de operación que necesitás.</span>
        </div>
        <div className="audit-access__grid">
          {PROFILES.map((profile, index) => (
            <motion.button key={profile.id} type="button" onClick={() => onSelectProfile(profile.id)}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12 + index * .06 }}
              className="audit-profile-card">
              <span className={`audit-profile-card__icon audit-profile-card__icon--${profile.tone}`}><profile.icon /></span>
              <span className="audit-profile-card__copy"><strong>{profile.label}</strong><small>{profile.description}</small></span>
              <ArrowRight className="audit-profile-card__arrow" />
            </motion.button>
          ))}
        </div>
        {firebaseEnabled && (
          <button className="audit-google" onClick={onLogin} disabled={isLoggingIn}>
            {user ? `Conectado como ${user.displayName || user.email}` : isLoggingIn ? "Conectando…" : "Sincronizar con Google"}
          </button>
        )}
      </section>
      <footer className="audit-welcome__footer"><span>Autosol Volkswagen</span><span>Gestión conectada · 2026</span></footer>
    </main>
  );
}
