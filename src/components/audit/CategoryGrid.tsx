import React from "react";
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
}

export function CategoryGrid({
  categories,
  completedReports,
  sampledOrdersProgress,
  sampledServiceAdvisorClientsProgress,
  onSelectCategory,
}: CategoryGridProps) {
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
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {categories.map((category, index) => {
        const Icon = getIcon(category.name);
        const report = completedReports.find((r) => r.role === category.name);
        
        let progress = report?.session.totalScore;
        if (category.name === "Ordenes") progress = sampledOrdersProgress;
        if (category.name === "Asesores de servicio") progress = sampledServiceAdvisorClientsProgress;
        
        const isCompleted = typeof progress === "number";

        return (
          <motion.button
            key={category.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelectCategory(category)}
            className={cn(
              "group relative flex flex-col items-start p-5 rounded-[2rem] border transition-all active:scale-95 text-left h-full min-h-[140px]",
              isCompleted
                ? "bg-emerald-50/50 border-emerald-100 hover:border-emerald-300 dark:bg-emerald-500/5 dark:border-emerald-500/20"
                : "bg-white border-slate-100 hover:border-blue-300 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-blue-500/50",
              "shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all"
            )}
          >
            <div className={cn(
              "h-12 w-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 group-hover:rotate-3",
              isCompleted ? "bg-emerald-500 text-white" : "bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10"
            )}>
              <Icon className="h-6 w-6" />
            </div>
            
            <div className="space-y-1 w-full">
              <span className={cn(
                "block font-black text-xs uppercase tracking-wider leading-tight",
                isCompleted ? "text-emerald-950 dark:text-emerald-400" : "text-slate-900 dark:text-slate-200"
              )}>
                {category.name}
              </span>
              
              {isCompleted ? (
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="flex-1 h-1.5 bg-emerald-200 dark:bg-emerald-500/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500" 
                      style={{ width: `${progress}%` }} 
                    />
                  </div>
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">{progress}%</span>
                </div>
              ) : (
                <div className="flex items-center justify-between mt-2 w-full">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pendiente</p>
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
