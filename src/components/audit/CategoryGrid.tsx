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

// Paleta de tonos pastel elegantes y contrastados por cada área
const ROLE_THEMES: Record<string, { iconBg: string; iconColor: string; hoverBorder: string; badge: string }> = {
  "Asesores de servicio": {
    iconBg: "bg-blue-50 text-blue-600",
    iconColor: "text-blue-600",
    hoverBorder: "hover:border-blue-300",
    badge: "bg-blue-50 text-blue-700",
  },
  "Técnicos": {
    iconBg: "bg-amber-50 text-amber-600",
    iconColor: "text-amber-600",
    hoverBorder: "hover:border-amber-300",
    badge: "bg-amber-50 text-amber-700",
  },
  "Jefe de Taller": {
    iconBg: "bg-indigo-50 text-indigo-600",
    iconColor: "text-indigo-600",
    hoverBorder: "hover:border-indigo-300",
    badge: "bg-indigo-50 text-indigo-700",
  },
  "Lavadero": {
    iconBg: "bg-cyan-50 text-cyan-600",
    iconColor: "text-cyan-600",
    hoverBorder: "hover:border-cyan-300",
    badge: "bg-cyan-50 text-cyan-700",
  },
  "Garantía": {
    iconBg: "bg-emerald-50 text-emerald-600",
    iconColor: "text-emerald-600",
    hoverBorder: "hover:border-emerald-300",
    badge: "bg-emerald-50 text-emerald-700",
  },
  "Repuestos": {
    iconBg: "bg-violet-50 text-violet-600",
    iconColor: "text-violet-600",
    hoverBorder: "hover:border-violet-300",
    badge: "bg-violet-50 text-violet-700",
  },
  "Pre Entrega": {
    iconBg: "bg-rose-50 text-rose-600",
    iconColor: "text-rose-600",
    hoverBorder: "hover:border-rose-300",
    badge: "bg-rose-50 text-rose-700",
  },
  "Ordenes": {
    iconBg: "bg-teal-50 text-teal-600",
    iconColor: "text-teal-600",
    hoverBorder: "hover:border-teal-300",
    badge: "bg-teal-50 text-teal-700",
  },
};

const DEFAULT_THEME = {
  iconBg: "bg-slate-50 text-slate-600",
  iconColor: "text-slate-600",
  hoverBorder: "hover:border-blue-300",
  badge: "bg-slate-50 text-slate-700",
};

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
    "Ordenes": "Órdenes de Reparación (OR)",
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
    if (name.includes("Garantía") || name.includes("Garantia")) return FileCheck;
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
        const theme = ROLE_THEMES[category.name] || DEFAULT_THEME;
        
        let progress = report?.session.totalScore;
        if (category.name === "Ordenes") progress = sampledOrdersProgress;
        if (category.name === "Asesores de servicio") progress = sampledServiceAdvisorClientsProgress;
        
        const isCompleted = count > 0;

        return (
          <motion.button
            key={category.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => onSelectCategory(category)}
            className={cn(
              "group relative flex min-h-[86px] items-center gap-3.5 rounded-2xl border bg-white p-4 text-left transition-all duration-200 active:scale-[0.98] shadow-xs hover:shadow-md",
              isCompleted
                ? "border-emerald-200 bg-emerald-50/20 hover:border-emerald-300"
                : cn("border-slate-200", theme.hoverBorder)
            )}
          >
            <div className={cn(
              "h-11 w-11 shrink-0 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs",
              isCompleted ? "bg-emerald-500 text-white" : theme.iconBg
            )}>
              <Icon className="h-5 w-5" />
            </div>
            
            <div className="flex-1 min-w-0">
              <span className="block truncate text-xs font-black uppercase tracking-wider text-slate-900">
                {getDisplayName(category.name)}
              </span>
              
              {isCompleted ? (
                <div className="space-y-1.5 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-500" 
                        style={{ width: `${progress || 0}%` }} 
                      />
                    </div>
                    <span className="text-[10px] font-black text-emerald-700">{progress || 0}%</span>
                  </div>
                  <p className="text-[9px] font-bold text-slate-500">
                    {category.name === "Ordenes" ? `${count} de ${advisorGoal} ORs completadas` : `${count} evaluación(es)`}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] font-bold text-slate-400">Iniciar evaluación</span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </div>
              )}
            </div>

            {isCompleted && (
              <div className="absolute top-3.5 right-3.5">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
