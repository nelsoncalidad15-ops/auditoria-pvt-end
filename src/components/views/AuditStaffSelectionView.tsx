import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  User, 
  Hash, 
  ArrowRight, 
  Users,
  Search,
  CheckCircle2,
  Car
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";

interface AuditStaffSelectionViewProps {
  role: string;
  staffList: string[];
  selectedStaff: string;
  onSelectStaff: (staffName: string) => void;
  orderNumber?: string;
  onOrderNumberChange?: (value: string) => void;
  clientIdentifier?: string;
  onClientIdentifierChange?: (value: string) => void;
  onContinue: () => void;
  onBack: () => void;
  isOrdersAudit: boolean;
  isServiceAdvisorAudit: boolean;
  isTechnicianAudit: boolean;
  staffProgress?: { advisorName: string; sampledCount: number }[];
}

export function AuditStaffSelectionView({
  role,
  staffList,
  selectedStaff,
  onSelectStaff,
  orderNumber,
  onOrderNumberChange,
  clientIdentifier,
  onClientIdentifierChange,
  onContinue,
  onBack,
  isOrdersAudit,
  isServiceAdvisorAudit,
  isTechnicianAudit,
  staffProgress
}: AuditStaffSelectionViewProps) {

  const [searchTerm, setSearchTerm] = useState("");

  const filteredStaff = staffList.filter(name => 
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canContinue = selectedStaff.trim() !== "" && (
    !isOrdersAudit || (orderNumber && /^\d{1,10}$/.test(orderNumber))
  ) && (
    !isServiceAdvisorAudit || (clientIdentifier && clientIdentifier.trim() !== "")
  );

  return (
    <div className="space-y-6">
      <div className="hero-shell rounded-[2.2rem] p-6 shadow-sm lg:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 shadow-sm">
              <div className="h-2 w-2 rounded-full bg-blue-600" />
              Configuración de Auditoría
            </span>
            <div className="space-y-1">
              <h2 className="text-2xl font-black tracking-tight text-slate-950 lg:text-3xl uppercase italic">{role}</h2>
              <p className="text-sm font-bold text-slate-500">Completá los datos del colaborador y la unidad a auditar.</p>
            </div>
          </div>
          
          <Button variant="secondary" onClick={onBack} className="w-fit">
            Volver a Áreas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
        <div className="space-y-6">
          {/* Staff Selection Grid */}
          <div className="premium-card p-6 bg-white dark:bg-slate-900 border-white/5 shadow-xl">
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Seleccioná al Colaborador</h3>
              </div>

              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Buscar nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredStaff.map((name) => {
                const progress = staffProgress?.find(p => p.advisorName === name);
                return (
                  <button
                    key={name}
                    onClick={() => onSelectStaff(name)}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border transition-all text-left group relative overflow-hidden",
                      selectedStaff === name
                        ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20"
                        : "bg-white dark:bg-slate-900 border-slate-100 dark:border-white/5 text-slate-900 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500/30"
                    )}
                  >
                    <div className="flex items-center gap-3 relative z-10">
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center",
                        selectedStaff === name ? "bg-white/20" : "bg-slate-100 dark:bg-white/5"
                      )}>
                        <User className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-sm uppercase tracking-tight">{name}</span>
                        {progress && (
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-widest mt-1",
                            selectedStaff === name ? "text-blue-100" : "text-slate-400"
                          )}>
                            {progress.sampledCount} {isOrdersAudit ? "ORs" : "Clientes"} completados
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 relative z-10">
                      {progress && (
                        <div className={cn(
                          "px-2 py-0.5 rounded-lg text-[9px] font-black",
                          selectedStaff === name 
                            ? "bg-white/20 text-white" 
                            : progress.sampledCount >= (isOrdersAudit ? 10 : 2)
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-blue-500/10 text-blue-500"
                        )}>
                          {progress.sampledCount}/{isOrdersAudit ? 10 : 2}
                        </div>
                      )}
                      {selectedStaff === name && (
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      )}
                    </div>
                  </button>
                );
              })}


            </div>
          </div>
        </div>

        <aside className="space-y-6">
          {/* Metadata Inputs */}
          <div className="premium-card p-6 bg-slate-950 text-white border-white/10 shadow-2xl space-y-8">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Detalles de la Auditoría</p>
            
            {isOrdersAudit && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <Hash className="h-3 w-3" />
                    Número de OR
                  </label>
                  <input 
                    type="text"
                    maxLength={10}
                    value={orderNumber || ""}
                    onChange={(e) => onOrderNumberChange?.(e.target.value.replace(/\D/g, ""))}
                    placeholder="Ej: 123456"
                    className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 font-black text-xl tracking-[0.2em] text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-center"
                  />
                </div>
                <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                  <p className="text-[10px] font-bold text-slate-400 italic">Recordá que auditamos un mínimo de 10 ORs por cada asesor mensualmente.</p>
                </div>
              </div>
            )}

            {isServiceAdvisorAudit && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <Car className="h-3 w-3" />
                  Nombre de Cliente o VIN
                </label>
                <input 
                  type="text"
                  value={clientIdentifier || ""}
                  onChange={(e) => onClientIdentifierChange?.(e.target.value)}
                  placeholder="Identificador de la unidad..."
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 font-bold text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            )}

            {isTechnicianAudit && (
              <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                <p className="text-[10px] font-bold text-slate-400">Auditoría técnica de proceso y calidad de reparación.</p>
              </div>
            )}

            <div className="pt-4">
              <Button
                size="lg"
                className="w-full h-16 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em]"
                disabled={!canContinue}
                onClick={onContinue}
              >
                <span>Comenzar Auditoría</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              {!canContinue && (
                <p className="mt-4 text-center text-[10px] font-bold text-rose-500 uppercase tracking-widest animate-pulse">
                  Faltan datos obligatorios
                </p>
              )}
            </div>
          </div>

          <div className="premium-card p-6 bg-white dark:bg-slate-900 border-slate-100 dark:border-white/5 shadow-xl">
             <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Ayuda rápida</h4>
             <ul className="space-y-3">
               <li className="flex gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-tight">
                 <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 mt-1" />
                 Para {role}, es fundamental identificar correctamente al responsable.
               </li>
               <li className="flex gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-tight">
                 <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 mt-1" />
                 Los resultados impactarán en el score mensual del colaborador.
               </li>
             </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
