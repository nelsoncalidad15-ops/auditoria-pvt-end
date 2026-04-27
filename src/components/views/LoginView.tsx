import { 
  ClipboardCheck, 
  ShieldCheck, 
  Eye, 
  LayoutDashboard, 
  History, 
  Settings2, 
  Activity,
  ArrowRight
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";
import { AuditUserProfile } from "../../types";

const PROFILES: {
  id: AuditUserProfile;
  label: string;
  icon: typeof ShieldCheck;
  accent: string;
  description: string;
}[] = [
  {
    id: "supervisor",
    label: "Supervisor",
    icon: ShieldCheck,
    accent: "bg-blue-600",
    description: "Acceso total a gestión, estructura y sincronización.",
  },
  {
    id: "auditor",
    label: "Auditor",
    icon: ClipboardCheck,
    accent: "bg-slate-900",
    description: "Realización de auditorías y carga de datos en campo.",
  },
  {
    id: "consulta",
    label: "Consulta",
    icon: Eye,
    accent: "bg-emerald-600",
    description: "Visualización de reportes e historial sin edición.",
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
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-0 md:p-4 overflow-y-auto custom-scrollbar">
      {/* Background Orbs */}
      <div className="fixed -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
      <div className="fixed -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />

      <div className="relative w-full max-w-6xl h-full md:h-auto min-h-screen md:min-h-0 md:max-h-[800px] flex flex-col lg:flex-row bg-white/70 dark:bg-slate-900/70 backdrop-blur-3xl md:rounded-[2.5rem] border-y md:border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        
        {/* Left Side: System Info & Sections */}
        <section className="relative w-full lg:w-[45%] p-8 lg:p-12 flex flex-col justify-between bg-slate-900 dark:bg-black overflow-hidden">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(#2563eb_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <ShieldCheck className="h-7 w-7 text-white" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Portal de Sistema</span>
            </div>

            <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tight leading-none mb-6">
              {appTitle.split(' ').map((word, i) => (
                <span key={i} className="block">{word}</span>
              ))}
            </h1>
            <p className="text-slate-400 font-medium text-lg max-w-sm leading-relaxed">
              Plataforma profesional de auditoría técnica y control de procesos de calidad.
            </p>
          </div>

          <div className="relative z-10 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <LayoutDashboard className="h-5 w-5 text-blue-400 mb-2" />
                <h3 className="text-xs font-black text-white uppercase tracking-widest mb-1">Dashboard</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-tight">Monitoreo en Tiempo Real</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <Activity className="h-5 w-5 text-emerald-400 mb-2" />
                <h3 className="text-xs font-black text-white uppercase tracking-widest mb-1">Campo</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-tight">Auditorías Técnicas</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <History className="h-5 w-5 text-amber-400 mb-2" />
                <h3 className="text-xs font-black text-white uppercase tracking-widest mb-1">Registros</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-tight">Historial de Calidad</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <Settings2 className="h-5 w-5 text-slate-400 mb-2" />
                <h3 className="text-xs font-black text-white uppercase tracking-widest mb-1">Sistema</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-tight">Gestión y Control</p>
              </div>
            </div>

            <div className="pt-6 border-t border-white/5 flex items-center justify-between">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">Autosol Jujuy · 2026</p>
              <div className="flex gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                <div className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                <div className="h-1.5 w-1.5 rounded-full bg-slate-700" />
              </div>
            </div>
          </div>
        </section>

        {/* Right Side: Profile Selection */}
        <section className="flex-1 p-8 lg:p-12 flex flex-col justify-center items-center">
          <div className="w-full max-w-md space-y-10">
            <div className="text-center">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Selección de Perfil</h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">Elegí tu rol para acceder al sistema de auditoría.</p>
            </div>

            <div className="space-y-4">
              {PROFILES.map((profile, i) => (
                <motion.button
                  key={profile.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => onSelectProfile(profile.id)}
                  className="group relative w-full p-5 flex items-center gap-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl hover:border-blue-400 dark:hover:border-blue-500 transition-all hover:shadow-xl hover:shadow-blue-500/5 text-left"
                >
                  <div className={cn(
                    "h-14 w-14 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg",
                    profile.accent
                  )}>
                    <profile.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white leading-none">{profile.label}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">{profile.description}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                    <ArrowRight className="h-5 w-5 text-blue-600" />
                  </div>
                </motion.button>
              ))}
            </div>

            {firebaseEnabled && (
              <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Autenticación Cloud</span>
                  <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                </div>

                {user ? (
                  <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-emerald-500/20">
                        {user.displayName?.charAt(0) || user.email?.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-emerald-900 dark:text-emerald-400 uppercase tracking-widest">Sincronizado como</p>
                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 truncate">{user.displayName || user.email}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={onLogin}
                    disabled={isLoggingIn}
                    className="w-full h-14 flex items-center justify-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
                  >
                    <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
                      <path d="M44.5 20H24v8.5h11.8C34.7 33.9 29.9 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 19.5-7.3 21-17.5.1-.8.2-1.6.2-2.5 0-.6-.1-1.3-.2-2.5z" fill="#4285F4"/>
                      <path d="M6.3 14.7l7 5.1C15.1 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6-6C34.6 5.1 29.6 3 24 3 16.3 3 9.6 7.9 6.3 14.7z" fill="#EA4335"/>
                      <path d="M24 45c5.8 0 10.7-1.9 14.3-5.2l-6.5-5.4C29.9 36.1 27.1 37 24 37c-5.8 0-10.7-3.8-12.4-9.1L4.1 33c3.4 6.8 10.4 12 19.9 12z" fill="#34A853"/>
                      <path d="M44.5 20H24v8.5h11.8c-.6 2.6-2 5-4.2 6.9l6.5 5.4C42.3 37.3 45 31.1 45 24c0-.6-.1-1.3-.2-2.5z" fill="#FBBC05"/>
                    </svg>
                    {isLoggingIn ? "Autenticando..." : "Sincronizar con Google"}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
