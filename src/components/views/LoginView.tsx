import { ClipboardCheck, Eye, ShieldCheck } from "lucide-react";

import { cn } from "../../lib/utils";
import { AuditUserProfile } from "../../types";

const PROFILES: {
  id: AuditUserProfile;
  label: string;
  icon: typeof ShieldCheck;
  accent: string;
  ring: string;
}[] = [
  {
    id: "supervisor",
    label: "Supervisor",
    icon: ShieldCheck,
    accent: "from-blue-700 to-blue-600",
    ring: "ring-blue-200",
  },
  {
    id: "auditor",
    label: "Auditor",
    icon: ClipboardCheck,
    accent: "from-slate-800 to-slate-700",
    ring: "ring-slate-200",
  },
  {
    id: "consulta",
    label: "Consulta",
    icon: Eye,
    accent: "from-slate-500 to-slate-400",
    ring: "ring-slate-100",
  },
];

interface LoginViewProps {
  appTitle: string;
  isLoggingIn: boolean;
  firebaseEnabled: boolean;
  user: { displayName?: string | null; email?: string | null } | null;
  onSelectProfile: (profile: AuditUserProfile) => void;
  onLogin: () => void;
}

export function LoginView({
  appTitle,
  isLoggingIn,
  firebaseEnabled,
  user,
  onSelectProfile,
  onLogin,
}: LoginViewProps) {
  return (
    <div className="login-shell">
      <div className="login-backdrop-orb login-backdrop-orb--left" />
      <div className="login-backdrop-orb login-backdrop-orb--right" />

      <div className="login-layout">
        <section className="login-brand-panel">
          <div className="login-brand-badge">Acceso</div>
          <div className="space-y-4">
            <div className="login-brand-logo">
              <ClipboardCheck className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-2">
              <h1 className="login-brand-title">{appTitle}</h1>
              <p className="login-brand-copy">Ingreso al sistema.</p>
            </div>
          </div>

          <div className="login-brand-metrics">
            <div className="login-brand-metric">
              <span className="login-brand-metric-value">3</span>
              <p className="login-brand-metric-copy">perfiles</p>
            </div>
            <div className="login-brand-metric">
              <span className="login-brand-metric-value">{firebaseEnabled ? "Cloud" : "Local"}</span>
              <p className="login-brand-metric-copy">modo</p>
            </div>
          </div>
        </section>

        <section className="login-form-panel">
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <div className="login-form-logo">
              <ClipboardCheck className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="login-form-kicker">Perfil</p>
              <h2 className="login-form-title">Selecciona tu perfil</h2>
              <p className="login-form-copy">Elige un rol.</p>
            </div>
          </div>

          <div className="flex w-full max-w-sm flex-col gap-3">
            {PROFILES.map(({ id, label, icon: Icon, accent, ring }) => (
              <button
                key={id}
                type="button"
                onClick={() => onSelectProfile(id)}
                className={cn(
                  "login-profile-card",
                  "shadow-[0_12px_28px_rgba(15,23,42,0.06)] hover:shadow-[0_18px_36px_rgba(15,23,42,0.1)]",
                  `hover:${ring}`
                )}
              >
                <div className={cn("login-profile-icon", accent)}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <span className="login-profile-label">{label}</span>
              </button>
            ))}
          </div>

          {firebaseEnabled && (
            <div className="mt-8 w-full max-w-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  {user ? user.displayName || user.email : "Google"}
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {user ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="max-w-[200px] truncate text-sm font-medium text-slate-600">
                    {user.displayName || user.email}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onLogin}
                  disabled={isLoggingIn}
                  className="login-google-button"
                >
                  <svg width="18" height="18" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                    <path d="M44.5 20H24v8.5h11.8C34.7 33.9 29.9 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 19.5-7.3 21-17.5.1-.8.2-1.6.2-2.5 0-.6-.1-1.3-.2-2.5z" fill="#4285F4"/>
                    <path d="M6.3 14.7l7 5.1C15.1 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6-6C34.6 5.1 29.6 3 24 3 16.3 3 9.6 7.9 6.3 14.7z" fill="#EA4335"/>
                    <path d="M24 45c5.8 0 10.7-1.9 14.3-5.2l-6.5-5.4C29.9 36.1 27.1 37 24 37c-5.8 0-10.7-3.8-12.4-9.1L4.1 33c3.4 6.8 10.4 12 19.9 12z" fill="#34A853"/>
                    <path d="M44.5 20H24v8.5h11.8c-.6 2.6-2 5-4.2 6.9l6.5 5.4C42.3 37.3 45 31.1 45 24c0-.6-.1-1.3-.2-2.5z" fill="#FBBC05"/>
                  </svg>
                  {isLoggingIn ? "Iniciando..." : "Entrar con Google"}
                </button>
              )}
            </div>
          )}

          <p className="mt-10 text-xs font-medium text-slate-300">Autosol · {new Date().getFullYear()}</p>
        </section>
      </div>
    </div>
  );
}

