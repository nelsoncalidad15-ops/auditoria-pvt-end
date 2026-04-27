import { 
  Save, 
  ChevronDown,
  FileCheck,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";
import { AuditSession, AuditTemplateItem, Role } from "../../types";
import { AuditItemRow } from "../audit/AuditItemRow";

interface AuditSessionViewProps {
  session: Partial<AuditSession>;
  selectedRole: Role | null;
  isOrdersAudit: boolean;
  isPreDeliveryAudit: boolean;
  visibleAuditItems: AuditTemplateItem[];
  isQuickAuditMode: boolean;
  setIsQuickAuditMode: React.Dispatch<React.SetStateAction<boolean>>;
  draftSaveState: "idle" | "saving" | "saved";
  draftSaveStateLabel: string;
  preDeliverySection: "general" | "legajos";
  setPreDeliverySection: React.Dispatch<React.SetStateAction<"general" | "legajos">>;
  activePreDeliveryLegajoCard: any;
  activePreDeliveryLegajoItems: AuditTemplateItem[];
  activePreDeliveryLegajoName: string;
  auditedFileNames: string[];
  activeAuditItemId: string | null;
  focusedAuditItemId: string | null;
  activeAuditItemIndex: number;
  activeAuditItem: AuditTemplateItem | null;
  activeAuditSessionItem: any;
  observationSuggestions: string[];
  isAuditChecklistCompleted: boolean;
  failItemsWithoutCommentCount: number;
  optionalPendingCount: number;
  isSubmitDisabled: boolean;
  isSendingToSheet: boolean;
  setSession: React.Dispatch<React.SetStateAction<Partial<AuditSession>>>;
  focusAuditItem: (item: AuditTemplateItem) => void;
  toggleItemStatus: (question: string, status: "pass" | "fail" | "na" | null) => void;
  updateItemComment: (question: string, comment: string) => void;
  updateItemPhoto: (question: string, photoUrl: string) => void;
  handleAuditSubmit: (mode: "continue" | "finish") => void;
  getAuditItemStatusLabel: (status?: string | null) => string;
  formatPreDeliveryLegajoQuestion: (question: string) => string;
}

export function AuditSessionView({
  session,
  selectedRole,
  isOrdersAudit,
  isPreDeliveryAudit,
  visibleAuditItems,
  isQuickAuditMode,
  setIsQuickAuditMode,
  draftSaveState,
  draftSaveStateLabel,
  preDeliverySection,
  setPreDeliverySection,
  activePreDeliveryLegajoCard,
  activePreDeliveryLegajoItems,
  activePreDeliveryLegajoName,
  auditedFileNames,
  activeAuditItemId,
  focusedAuditItemId,
  activeAuditItemIndex,
  activeAuditItem,
  activeAuditSessionItem,
  observationSuggestions,
  isSubmitDisabled,
  isSendingToSheet,
  setSession,
  focusAuditItem,
  toggleItemStatus,
  updateItemComment,
  updateItemPhoto,
  handleAuditSubmit,
  getAuditItemStatusLabel,
  formatPreDeliveryLegajoQuestion,
}: AuditSessionViewProps) {
  const sessionItems = session.items || [];
  
  // Logic: Calculate Progress
  const totalItemsCount = visibleAuditItems.length;
  const answeredItemsCount = visibleAuditItems.filter(v => 
    sessionItems.find(s => (s.id === v.id || s.question === v.text) && s.status)
  ).length;
  
  const progressPercentage = totalItemsCount > 0 ? Math.round((answeredItemsCount / totalItemsCount) * 100) : 0;
  
  // Logic: Calculate Current Compliance
  const applicableSessionItems = sessionItems.filter(s => s.status && s.status !== "na");
  const obtainedWeight = applicableSessionItems.reduce((acc, item) => acc + (item.status === "pass" ? (item.weight || 1) : 0), 0);
  const totalApplicableWeight = applicableSessionItems.reduce((acc, item) => acc + (item.weight || 1), 0);
  const currentCompliance = totalApplicableWeight > 0 ? Math.round((obtainedWeight / totalApplicableWeight) * 100) : 0;

  // Logic: Identify items requiring mandatory comments
  const itemsRequiringComment = visibleAuditItems.filter(templateItem => {
    const sessionItem = sessionItems.find(s => s.id === templateItem.id || s.question === templateItem.text);
    return templateItem.requiresCommentOnFail && sessionItem?.status === "fail" && !sessionItem?.comment?.trim();
  });

  const isServiceAdvisorAudit = selectedRole === "Asesores de servicio";
  const isTechnicianAudit = selectedRole === "Técnicos";
  const preDeliveryGeneralItems = visibleAuditItems.filter((item) => !(item.block || "").startsWith("Legajo auditado "));

  return (
    <div className="audit-session-view">
      {/* Mobile Top Progress Bar */}
      <div className="fixed top-[72px] left-0 right-0 z-50 lg:hidden">
        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800">
          <motion.div 
            className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        
        {/* Contenido Principal (Ahora a la izquierda) */}
        <div className="space-y-6 order-1">
          {isPreDeliveryAudit && preDeliverySection === "legajos" && (
            <div className="premium-card p-6 bg-white dark:bg-slate-900 border-white/5 shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Edición de Legajo</p>
                  <h3 className="mt-1 text-lg font-black text-slate-950 dark:text-white truncate">
                    {activePreDeliveryLegajoCard ? `Legajo ${activePreDeliveryLegajoCard.index + 1}` : "Seleccionar Legajo"}
                  </h3>
                </div>
                {activePreDeliveryLegajoCard && (
                  <div className="w-full md:w-64">
                    <input
                      type="text"
                      value={activePreDeliveryLegajoCard.name}
                      onChange={(e) => {
                        const nextAuditedFileNames = [...auditedFileNames];
                        nextAuditedFileNames[activePreDeliveryLegajoCard.index] = e.target.value;
                        setSession({
                          ...session,
                          auditedFileNames: nextAuditedFileNames,
                        });
                      }}
                      placeholder="Nombre de legajo o persona"
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className={cn("space-y-4", isQuickAuditMode ? "pb-40" : "pb-24 lg:pb-0")}>
            <div className="premium-card bg-white dark:bg-slate-900 p-4 lg:p-8 overflow-hidden border-white/5 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[--accent-neon] neon-text">Checklist Engine</p>
                  <h3 className="mt-1 text-2xl font-black text-slate-950 dark:text-white tracking-tight uppercase">
                    {isOrdersAudit ? "OR Postventa" : isPreDeliveryAudit ? `Controles - ${preDeliverySection === "general" ? "General" : "Legajos"}` : "Controles de Calidad"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuickAuditMode((current) => !current)}
                  className={cn(
                    "rounded-full border px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] transition-all",
                    isQuickAuditMode
                      ? "border-[--accent-neon] bg-[--accent-neon] text-[#050a14] shadow-lg shadow-[--accent-neon-glow]"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400"
                  )}
                >
                  {isQuickAuditMode ? "MODO RÁPIDO" : "MODO COMPLETO"}
                </button>
              </div>

              <div className="space-y-4">
                {isPreDeliveryAudit ? (
                  <>
                    {preDeliverySection === "general" ? (
                      preDeliveryGeneralItems.map((auditItem, index) => (
                        <AuditItemRow
                          key={auditItem.id}
                          rowId={`audit-item-${auditItem.id}`}
                          question={auditItem.text}
                          index={index}
                          item={session.items?.find((item) => item.id === auditItem.id || item.question === auditItem.text)}
                          required={false}
                          block={auditItem.block}
                          description={auditItem.description}
                          responsibleRoles={auditItem.responsibleRoles}
                          scoreAreas={auditItem.scoreAreas}
                          allowsNa={auditItem.allowsNa}
                          priority={auditItem.priority}
                          guidance={auditItem.guidance}
                          requiresCommentOnFail={auditItem.requiresCommentOnFail}
                          emphasized={focusedAuditItemId === auditItem.id || activeAuditItemId === auditItem.id}
                          showStructuredQuestion={false}
                          compactMeta
                          quickMode={isQuickAuditMode}
                          isActive={activeAuditItemId === auditItem.id}
                          observationSuggestions={observationSuggestions}
                          onActivate={() => focusAuditItem(auditItem)}
                          onStatusToggle={(status) => toggleItemStatus(auditItem.text, status)}
                          onCommentUpdate={(comment) => updateItemComment(auditItem.text, comment)}
                          onPhotoUpdate={(photoUrl) => updateItemPhoto(auditItem.text, photoUrl || "")}
                        />
                      ))
                    ) : (
                      activePreDeliveryLegajoName ? (
                        activePreDeliveryLegajoItems.map((auditItem, index) => (
                          <AuditItemRow
                            key={auditItem.id}
                            rowId={`audit-item-${auditItem.id}`}
                            question={formatPreDeliveryLegajoQuestion(auditItem.text)}
                            index={index}
                            item={session.items?.find((item) => item.id === auditItem.id || item.question === auditItem.text)}
                            required={false}
                            block={auditItem.block}
                            description={auditItem.description}
                            responsibleRoles={auditItem.responsibleRoles}
                            scoreAreas={auditItem.scoreAreas}
                            allowsNa={auditItem.allowsNa}
                            priority={auditItem.priority}
                            guidance={auditItem.guidance}
                            requiresCommentOnFail={auditItem.requiresCommentOnFail}
                            emphasized={focusedAuditItemId === auditItem.id || activeAuditItemId === auditItem.id}
                            showStructuredQuestion={false}
                            compactMeta
                            quickMode={isQuickAuditMode}
                            isActive={activeAuditItemId === auditItem.id}
                            observationSuggestions={observationSuggestions}
                            weight={auditItem.weight}
                            onActivate={() => focusAuditItem(auditItem)}
                            onStatusToggle={(status) => toggleItemStatus(auditItem.text, status)}
                            onCommentUpdate={(comment) => updateItemComment(auditItem.text, comment)}
                            onPhotoUpdate={(photoUrl) => updateItemPhoto(auditItem.text, photoUrl || "")}
                          />
                        ))
                      ) : (
                        <div className="rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-6 py-12 text-center">
                          <p className="text-sm font-bold text-slate-500">Ingresá un nombre en el legajo activo para ver sus controles.</p>
                        </div>
                      )
                    )}
                  </>
                ) : (
                  visibleAuditItems.map((auditItem, index) => (
                    <AuditItemRow
                      key={auditItem.id}
                      rowId={`audit-item-${auditItem.id}`}
                      question={auditItem.text}
                      index={index}
                      item={session.items?.find((item) => item.id === auditItem.id || item.question === auditItem.text)}
                      required={false}
                      block={auditItem.block}
                      description={auditItem.description}
                      responsibleRoles={auditItem.responsibleRoles}
                      scoreAreas={auditItem.scoreAreas}
                      allowsNa={auditItem.allowsNa}
                      priority={auditItem.priority}
                      guidance={auditItem.guidance}
                      requiresCommentOnFail={auditItem.requiresCommentOnFail}
                      emphasized={focusedAuditItemId === auditItem.id || activeAuditItemId === auditItem.id}
                      showStructuredQuestion={isOrdersAudit}
                      quickMode={isQuickAuditMode}
                      isActive={activeAuditItemId === auditItem.id}
                      observationSuggestions={observationSuggestions}
                      weight={auditItem.weight}
                      onActivate={() => focusAuditItem(auditItem)}
                      onStatusToggle={(status) => toggleItemStatus(auditItem.text, status)}
                      onCommentUpdate={(comment) => updateItemComment(auditItem.text, comment)}
                      onPhotoUpdate={(photoUrl) => updateItemPhoto(auditItem.text, photoUrl || "")}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Cierre de Auditoría */}
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Observaciones Generales</label>
                <textarea
                  placeholder="Escribe aquí cualquier observación adicional sobre la auditoría..."
                  value={session.notes || ""}
                  onChange={(e) => setSession({ ...session, notes: e.target.value })}
                  className="w-full p-8 bg-white dark:bg-slate-900 border border-white/5 rounded-[2rem] font-medium text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[--accent-neon]/20 shadow-2xl min-h-[160px] resize-none"
                />
              </div>
            </div>

            {/* Submit Actions for Mobile - Only visible when not in LG screen */}
            <div className="mt-8 space-y-4 lg:hidden">
              <button
                onClick={() => handleAuditSubmit("finish")}
                disabled={isSubmitDisabled}
                className={cn(
                  "w-full h-16 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl relative overflow-hidden",
                  !isSubmitDisabled
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50"
                )}
              >
                {isSendingToSheet ? (
                  <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                ) : (
                  <Save className="h-5 w-5" />
                )}
                <span>{isSendingToSheet ? "PROCESANDO..." : "FINALIZAR AUDITORÍA"}</span>
              </button>

              {(isOrdersAudit || isServiceAdvisorAudit || isTechnicianAudit) && (
                <button
                  onClick={() => handleAuditSubmit("continue")}
                  disabled={isSubmitDisabled}
                  className={cn(
                    "w-full h-14 rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 border transition-all active:scale-95",
                    !isSubmitDisabled
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-white/10"
                      : "bg-transparent text-slate-400 border-slate-100 dark:border-white/5 cursor-not-allowed"
                  )}
                >
                  <Save className="h-4 w-4" />
                  {isServiceAdvisorAudit ? "PRÓXIMO CLIENTE" : isTechnicianAudit ? "PRÓXIMO TÉCNICO" : "PRÓXIMA ORDEN"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar de Auditoría (Ahora a la derecha) */}
        <aside className="hidden lg:block space-y-4 order-2">
          <div className="premium-card p-6 bg-white dark:bg-slate-900 sticky top-28 border-white/5 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[--accent-neon] neon-text">Avance</p>
                <h2 className="text-xl font-black text-slate-950 dark:text-white leading-tight uppercase italic">{selectedRole}</h2>
              </div>
              <div className="relative h-16 w-16 flex items-center justify-center">
                <svg className="h-full w-full transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    className="text-slate-100 dark:text-slate-800"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray={175.9}
                    strokeDashoffset={175.9 * (1 - progressPercentage / 100)}
                    className="text-blue-600 transition-all duration-700 ease-out"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-[11px] font-black text-slate-900 dark:text-white">{progressPercentage}%</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Draft Status</span>
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg",
                  draftSaveState === "saved" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                )}>{draftSaveStateLabel}</span>
              </div>
              
              {session.location && (
                <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Location</span>
                  <span className="text-[11px] font-black text-white uppercase tracking-tight">{session.location}</span>
                </div>
              )}

              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Completados</span>
                <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight">{answeredItemsCount} / {totalItemsCount}</span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Resultado Actual</span>
                <span className={cn(
                  "text-[11px] font-black uppercase tracking-tight px-2 py-0.5 rounded-md",
                  currentCompliance >= 90 ? "text-emerald-500 bg-emerald-500/5" : currentCompliance >= 70 ? "text-amber-500 bg-amber-500/5" : "text-red-500 bg-red-500/5"
                )}>{currentCompliance}%</span>
              </div>
            </div>

            <div className="mt-8 space-y-3">
                <button
                  onClick={() => handleAuditSubmit("finish")}
                  disabled={isSubmitDisabled}
                  className={cn(
                    "w-full h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg relative overflow-hidden group",
                    !isSubmitDisabled
                      ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-xl"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50"
                  )}
                >
                  {isSendingToSheet ? (
                    <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span className="relative z-10">{isSendingToSheet ? "PROCESANDO..." : "FINALIZAR CARGA"}</span>
                  {!isSubmitDisabled && (
                    <motion.div 
                      className="absolute inset-0 bg-blue-600/10 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500"
                    />
                  )}
                </button>

                {(isOrdersAudit || isServiceAdvisorAudit || isTechnicianAudit) && (
                  <button
                    onClick={() => handleAuditSubmit("continue")}
                    disabled={isSubmitDisabled}
                    className={cn(
                      "w-full h-12 rounded-xl font-black text-[10px] uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all active:scale-95",
                      !isSubmitDisabled
                        ? "bg-white/5 text-white border border-white/10 hover:bg-white/10"
                        : "bg-transparent text-slate-600 border border-white/5 cursor-not-allowed"
                    )}
                  >
                    <Save className="h-3 w-3" />
                    {isServiceAdvisorAudit ? "Next Client" : isTechnicianAudit ? "Next Tech" : "Next Order"}
                  </button>
                )}
            </div>
            
            {itemsRequiringComment.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Notas obligatorias faltantes</p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {itemsRequiringComment.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        const element = document.getElementById(`audit-item-${item.id}`);
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          focusAuditItem(item);
                        }
                      }}
                      className="w-full text-left p-3 rounded-xl bg-red-500/5 border border-red-500/10 hover:border-red-500/30 transition-all group"
                    >
                      <p className="text-[10px] font-bold text-slate-900 dark:text-slate-200 line-clamp-2 leading-tight group-hover:text-red-500 transition-colors">
                        {item.text}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {isPreDeliveryAudit && (
            <div className="premium-card p-6 bg-white dark:bg-slate-900 border-white/5 shadow-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 mb-4 tracking-[0.2em]">Sections</p>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => setPreDeliverySection("general")}
                  className={cn(
                    "flex items-center gap-3 p-3.5 rounded-2xl transition-all font-black text-[11px] uppercase tracking-widest",
                    preDeliverySection === "general" 
                      ? "bg-[--accent-neon] text-[#050a14] shadow-lg shadow-[--accent-neon-glow]" 
                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  )}
                >
                  <FileCheck className="h-4 w-4" />
                  General
                </button>
                <button
                  onClick={() => setPreDeliverySection("legajos")}
                  className={cn(
                    "flex items-center gap-3 p-3.5 rounded-2xl transition-all font-black text-[11px] uppercase tracking-widest",
                    preDeliverySection === "legajos" 
                      ? "bg-[--accent-neon] text-[#050a14] shadow-lg shadow-[--accent-neon-glow]" 
                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  )}
                >
                  <ChevronDown className="h-4 w-4" />
                  Legajos
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Quick Bar Mobile - Premium Controller */}
      {isQuickAuditMode && activeAuditItem && (
        <div className="fixed inset-x-0 bottom-4 z-50 px-4 lg:hidden safe-area-bottom">
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mx-auto max-w-lg rounded-[2.5rem] bg-slate-900/95 border border-white/10 shadow-2xl backdrop-blur-xl ring-4 ring-black/20 overflow-hidden"
          >
            {/* Progress Micro-bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
               <motion.div 
                 className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                 initial={{ width: 0 }}
                 animate={{ width: `${(answeredCount / visibleAuditItems.length) * 100}%` }}
               />
            </div>

            <div className="p-5 pt-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">
                      Ítem {activeAuditItemIndex + 1} de {visibleAuditItems.length}
                    </p>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[13px] font-bold text-white leading-snug tracking-tight">
                    {isPreDeliveryAudit && preDeliverySection === "legajos" 
                      ? formatPreDeliveryLegajoQuestion(activeAuditItem.text) 
                      : activeAuditItem.text}
                  </p>
                </div>
                
                <div className="flex flex-col items-end gap-1">
                  <span className={cn(
                    "shrink-0 rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-widest border",
                    activeAuditSessionItem?.status === "pass" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                    activeAuditSessionItem?.status === "fail" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                    activeAuditSessionItem?.status === "na" ? "bg-slate-500/10 text-slate-400 border-white/10" :
                    "bg-white/5 text-slate-500 border-white/5"
                  )}>
                    {activeAuditSessionItem?.status ? getAuditItemStatusLabel(activeAuditSessionItem.status) : "Pendiente"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => toggleItemStatus(activeAuditItem.text, "pass")}
                  className={cn(
                    "h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-90 flex flex-col items-center justify-center gap-1",
                    activeAuditSessionItem?.status === "pass" 
                      ? "bg-emerald-500 text-white shadow-[0_8px_20px_rgba(16,185,129,0.3)]" 
                      : "bg-white/5 text-emerald-500 border border-emerald-500/20"
                  )}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  CUMPLE
                </button>
                <button
                  type="button"
                  onClick={() => toggleItemStatus(activeAuditItem.text, "fail")}
                  className={cn(
                    "h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-90 flex flex-col items-center justify-center gap-1",
                    activeAuditSessionItem?.status === "fail" 
                      ? "bg-red-500 text-white shadow-[0_8px_20px_rgba(239,68,68,0.3)]" 
                      : "bg-white/5 text-red-500 border border-red-500/20"
                  )}
                >
                  <XCircle className="h-4 w-4" />
                  FALLA
                </button>
                <button
                  type="button"
                  disabled={activeAuditItem.allowsNa === false}
                  onClick={() => toggleItemStatus(activeAuditItem.text, "na")}
                  className={cn(
                    "h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-90 border flex flex-col items-center justify-center gap-1",
                    activeAuditSessionItem?.status === "na"
                      ? "bg-slate-700 text-white border-white/20"
                      : activeAuditItem.allowsNa !== false
                        ? "bg-white/5 text-slate-400 border-white/5"
                        : "bg-white/5 text-slate-700 border-white/5 opacity-50 cursor-not-allowed"
                  )}
                >
                  <MinusCircle className="h-4 w-4" />
                  N/A
                </button>
              </div>

              {/* Botón de Finalizar Rápido en Mobile */}
              {answeredItemsCount === totalItemsCount && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="mt-4 pt-4 border-t border-white/10"
                >
                  <button
                    onClick={() => handleAuditSubmit("finish")}
                    disabled={isSubmitDisabled}
                    className="w-full h-12 rounded-xl bg-blue-600 text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                  >
                    {isSendingToSheet ? "PROCESANDO..." : "FINALIZAR AHORA"}
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Mobile Summary Bubble (Floating Score) */}
      {!isQuickAuditMode && (
        <div className="fixed bottom-6 right-6 z-40 lg:hidden">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            className="h-16 w-16 rounded-full bg-slate-900 border border-white/20 shadow-2xl flex flex-col items-center justify-center text-white backdrop-blur-xl ring-4 ring-blue-600/20"
          >
            <span className="text-[8px] font-black uppercase opacity-60">Score</span>
            <span className="text-base font-black">{currentCompliance}%</span>
          </motion.div>
        </div>
      )}
    </div>
  );
}
