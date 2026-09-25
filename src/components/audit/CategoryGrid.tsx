
import { 
  UserCheck, 
  Wrench, 
  ShieldCheck, 
  Droplets, 
  FileCheck, 
  Package, 
  Truck, 
  FileText, 
  ClipboardList,
  ChevronRight
} from "lucide-react";
import { cn } from "../../lib/utils";
import { AuditCategory, CompletedAuditReport } from "../../types";
import { motion } from "motion/react";

interface CategoryGridProps {
  categories: AuditCategory[];
  completedReports: CompletedAuditReport[];
  sampledOrdersProgress?: number;
  sampledServiceAdvisorClientsProgress?: number;
  onSelectCategory: (category: AuditCategory) => void;
  auditCounts?: Record<string, number>;
  advisorGoal?: number;
}

export function CategoryGrid({
  categories,
  completedReports,
  sampledOrdersProgress,
  sampledServiceAdvisorClientsProgress,
  onSelectCategory,
  auditCounts = {},
  advisorGoal = 10,
}: CategoryGridProps) {
  const getDisplayName = (name: string) => ({
    "Ordenes": "Órdenes de reparación",
    "Tecnicos": "Técnicos",
    "TÃ©cnicos": "Técnicos",
    "Garantia": "Garantía",
    "GarantÃ­a": "Garantía",
    "Pre Entrega": "Pre-entrega",
  }[name] || name);
  const getIcon = (name: string) => {
    if (name.includes("Asesor")) return UserCheck;
    if (name.includes("Técnico")) return Wrench;
    if (name.includes("Jefe")) return ShieldCheck;
    if (name.includes("Lavadero")) return Droplets;
    if (name.includes("Garantía")) return FileCheck;
    if (name.includes("Repuestos")) return Package;
    if (name.includes("Pre Entrega")) return Truck;
    if (name.includes("Ordenes")) return FileText;
    return ClipboardList;
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category, index) => {
        const Icon = getIcon(category.name);
        const report = completedReports.find((r) => r.role === category.name);
        const count = auditCounts[category.name] || 0;
        
        let progress = report?.session.totalScore;
        if (category.name === "Ordenes") progress = sampledOrdersProgress;
        if (category.name === "Asesores de servicio") progress = sampledServiceAdvisorClientsProgress;
        
        const isCompleted = count > 0;

        return (
          <motion.button
            key={category.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelectCategory(category)}
            className={cn(
              "group relative flex min-h-[82px] items-center gap-3 rounded-2xl border p-3.5 text-left transition-all active:scale-[0.98]",
              isCompleted
                ? "bg-emerald-50/50 border-emerald-100 hover:border-emerald-300 dark:bg-emerald-500/5 dark:border-emerald-500/20"
                : "bg-white border-slate-100 hover:border-blue-300 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-blue-500/50",
              "shadow-sm hover:-translate-y-0.5 hover:shadow-md"
            )}
          >
            <div className={cn(
              "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105",
              isCompleted ? "bg-emerald-500 text-white" : "bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10"
            )}>
              <Icon className="h-5 w-5" />
            </div>
            
            <div className="space-y-1 w-full">
              <span className={cn(
                "block pr-4 font-black text-[11px] uppercase tracking-wider leading-tight",
                isCompleted ? "text-emerald-950 dark:text-emerald-400" : "text-slate-900 dark:text-slate-200"
              )}>
                {getDisplayName(category.name)}
              </span>
              
              {isCompleted ? (
                <div className="space-y-1.5 mt-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-emerald-200 dark:bg-emerald-500/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500" 
                        style={{ width: `${progress || 0}%` }} 
                      />
                    </div>
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">{progress || 0}%</span>
                  </div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700/60 dark:text-emerald-400/60">
                    {category.name === "Ordenes" ? `${count} / ${advisorGoal} ORs` : category.name === "Asesores de servicio" ? `${count} / ${advisorGoal} Audit.` : `${count} Audit.`}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between mt-1.5 w-full">
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Seleccionar</p>
                   <ChevronRight className="h-3 w-3 text-slate-300 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all" />
                </div>
              )}
            </div>

            {isCompleted && (
              <div className="absolute top-4 right-4">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
