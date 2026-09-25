import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { 
  ArrowDown, 
  ArrowUp, 
  FolderKanban, 
  Link2, 
  ListChecks, 
  PlusCircle, 
  Trash2,
  ChevronRight,
  Info,
  Layers,
  Database,
  Table,
  Users,
  Check,
} from "lucide-react";
import { cn } from "../../lib/utils";
import {
  AuditCategory,
  CalculationRule,
  AuditItemPriority,
  AuditStructureScope,
  OrAuditSector,
  OrResponsibleRole,
} from "../../types";

interface StructurePanelProps {
  selectedStructureScope: AuditStructureScope;
  setSelectedStructureScope: (scope: AuditStructureScope) => void;
  structureStorageLabel: "local" | "cloud" | "sheet";
  isLoadingStructureFromCloud: boolean;
  isSavingStructureToCloud: boolean;
  isLoadingStructureFromSheet: boolean;
  isSavingStructureToSheet: boolean;
  handleLoadStructureFromCloud: () => void;
  handleSaveStructureToCloud: () => void;
  handleSaveStructureToSheet: () => void;
  handleLoadStructureFromSheet: () => void;
  handleResetStructure: () => void;
  auditCategories: AuditCategory[];
  calculationRules: CalculationRule[];
  handleToggleCalculationLink: (link: {
    sourceArea: string;
    sourceItemId: string;
    targetArea: string;
    targetItemId: string;
  }) => void;
  selectedStructureCategory: AuditCategory | null;
  selectedStructureCategoryId: string;
  setSelectedStructureCategoryId: (categoryId: string) => void;
  handleDuplicateCategory: (categoryId: string) => void;
  handleDeleteCategory: (categoryId: string) => void;
  handleDeleteItem: (categoryId: string, itemId: string) => void;
  updateCategory: (categoryId: string, updater: (category: AuditCategory) => AuditCategory) => void;
  newCategoryName: string;
  setNewCategoryName: (value: string) => void;
  newCategoryDescription: string;
  setNewCategoryDescription: (value: string) => void;
  newCategoryStaff: string;
  setNewCategoryStaff: (value: string) => void;
  handleAddCategory: () => void;
  newItemText: string;
  setNewItemText: (value: string) => void;
  availableScoreAreas: string[];
  newItemDescription: string;
  setNewItemDescription: (value: string) => void;
  newItemGuidance: string;
  setNewItemGuidance: (value: string) => void;
  newItemBlock: string;
  setNewItemBlock: (value: string) => void;
  newItemSector: OrAuditSector;
  setNewItemSector: (value: OrAuditSector) => void;
  newItemResponsibleRoles: OrResponsibleRole[];
  setNewItemResponsibleRoles: (updater: OrResponsibleRole[] | ((current: OrResponsibleRole[]) => OrResponsibleRole[])) => void;
  newItemPriority: AuditItemPriority;
  setNewItemPriority: (value: AuditItemPriority) => void;
  newItemWeight: number;
  setNewItemWeight: (value: number) => void;
  newItemRequired: boolean;
  setNewItemRequired: (value: boolean) => void;
  newItemAllowsNa: boolean;
  setNewItemAllowsNa: (value: boolean) => void;
  newItemActive: boolean;
  setNewItemActive: (value: boolean) => void;
  newItemRequiresCommentOnFail: boolean;
  setNewItemRequiresCommentOnFail: (value: boolean) => void;
  handleAddItem: () => void;
  handleMoveItem: (itemId: string, direction: "up" | "down") => void;
  handleToggleItemResponsibleRole: (itemId: string, role: OrResponsibleRole) => void;
  lastStructureSavedAt: string | null;
  hasPendingStructureChanges: boolean;
}

type TabType = "categories" | "questions" | "matrix";

export function StructurePanel({
  selectedStructureScope,
  setSelectedStructureScope,
  auditCategories,
  calculationRules,
  handleToggleCalculationLink,
  selectedStructureCategory,
  selectedStructureCategoryId,
  setSelectedStructureCategoryId,
  handleDuplicateCategory,
  handleDeleteCategory,
  handleDeleteItem,
  updateCategory,
  newCategoryName,
  setNewCategoryName,
  newCategoryDescription,
  setNewCategoryDescription,
  newCategoryStaff,
  setNewCategoryStaff,
  handleAddCategory,
  newItemText,
  setNewItemText,
  newItemSector,
  setNewItemSector,
  newItemResponsibleRoles,
  setNewItemResponsibleRoles,
  handleAddItem,
  handleMoveItem,
  handleToggleItemResponsibleRole,
  lastStructureSavedAt,
  handleSaveStructureToCloud: _handleSaveStructureToCloud,
  handleSaveStructureToSheet,
  handleLoadStructureFromSheet,
  isSavingStructureToCloud: _isSavingStructureToCloud,
  isSavingStructureToSheet,
  isLoadingStructureFromSheet,
  hasPendingStructureChanges,
}: StructurePanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("categories");
  const [itemSearch, setItemSearch] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [selectedSourceAreaName, setSelectedSourceAreaName] = useState("");
  const [selectedTargetAreaName, setSelectedTargetAreaName] = useState("");
  const renderableCategories = auditCategories.filter((category) => category.name.trim().length > 0);
  
  const savedLabel = lastStructureSavedAt
    ? new Date(lastStructureSavedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : null;

  // Auto-select category if none selected
  useEffect(() => {
    if (!selectedStructureCategory && renderableCategories.length > 0) {
      setSelectedStructureCategoryId(renderableCategories[0].id);
    }
  }, [renderableCategories, selectedStructureCategory, setSelectedStructureCategoryId]);

  // Derived data
  const selectedStructureItems = selectedStructureCategory?.items ?? [];
  const visibleStructureItems = selectedStructureItems.filter((item) => {
    const normalizedSearch = itemSearch.trim().toLowerCase();
    const matchesSearch = !normalizedSearch
      || item.text.toLowerCase().includes(normalizedSearch)
      || (item.block ?? "").toLowerCase().includes(normalizedSearch);
    const matchesActive = !showOnlyActive || item.active !== false;
    return matchesSearch && matchesActive;
  });

  const sourceMatrixItems = renderableCategories.find(c => c.name === selectedSourceAreaName)?.items ?? [];
  const targetMatrixItems = renderableCategories.find(c => c.name === selectedTargetAreaName)?.items ?? [];
  const isOrdersCategory = selectedStructureCategory?.name.toLowerCase().includes("orden") ?? false;
  const responsibleRoleOptions: Array<{ value: OrResponsibleRole; label: string }> = [
    { value: "asesor", label: "Asesor" },
    { value: "tecnico", label: "Técnico" },
    { value: "controller", label: "Controller" },
    { value: "lavador", label: "Lavador" },
    { value: "repuestos", label: "Repuestos" },
  ];
  const sectorLabels: Record<OrAuditSector, string> = {
    recepcion: "Recepción",
    taller: "Taller",
    control_calidad: "Control de calidad",
    lavado: "Lavado",
    repuestos: "Repuestos",
    resumen: "Resumen",
  };


  return (
    <div className="space-y-4 animate-in fade-in duration-700">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Estructura de auditorías</h2>
          </div>
          <p className="text-xs font-medium text-slate-500 flex items-center gap-2">
             Administrá áreas, preguntas y reglas de cálculo.
             {savedLabel && <span>Último guardado: {savedLabel}</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Sync Buttons */}
          <div className="flex items-center gap-2 relative">
            {hasPendingStructureChanges && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 h-4 w-4 bg-amber-500 rounded-full border-2 border-white dark:border-slate-900 z-10 flex items-center justify-center shadow-lg"
              >
                <div className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
              </motion.div>
            )}
            <button 
              onClick={handleLoadStructureFromSheet}
              disabled={isLoadingStructureFromSheet}
              title="Leer la configuración vigente de Google Sheets"
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              <Table className="h-4 w-4" />
              {isLoadingStructureFromSheet ? "Recargando..." : "Recargar"}
            </button>
            
            <button 
              onClick={handleSaveStructureToSheet}
              disabled={isSavingStructureToSheet}
              title="Guardar la estructura actual en Google Sheets"
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                hasPendingStructureChanges ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-100 text-slate-400"
              )}
            >
              <Database className="h-4 w-4" />
              {isSavingStructureToSheet ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>

          <div className="h-10 w-[1px] bg-slate-200 dark:bg-white/10 hidden lg:block" />
          
          <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/5">
             {(["global", "Salta", "Jujuy"] as AuditStructureScope[]).map((scope) => (
               <button
                 key={scope}
                 onClick={() => setSelectedStructureScope(scope)}
                 className={cn(
                   "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                   selectedStructureScope === scope 
                    ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm" 
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                 )}
               >
                 {scope === "global" ? "Base" : scope}
               </button>
             ))}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl w-fit border border-slate-200 dark:border-white/5">
        <button 
          onClick={() => setActiveTab("categories")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
            activeTab === "categories" ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-md" : "text-slate-500"
          )}
        >
          <FolderKanban className="h-4 w-4" /> Áreas
        </button>
        <button 
          onClick={() => setActiveTab("questions")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
            activeTab === "questions" ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-md" : "text-slate-500"
          )}
        >
          <ListChecks className="h-4 w-4" /> Preguntas
        </button>
        <button 
          onClick={() => setActiveTab("matrix")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
            activeTab === "matrix" ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-md" : "text-slate-500"
          )}
        >
          <Link2 className="h-4 w-4" /> Reglas de cálculo
        </button>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 gap-4">
        
        {/* Tab: Categories */}
        {activeTab === "categories" && (
          <div className="space-y-4 animate-in slide-in-from-left-4 duration-500">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2"><PlusCircle className="h-4 w-4 text-blue-600" /><h4 className="text-xs font-black text-slate-900">Agregar área</h4></div>
              <div className="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_minmax(200px,1.2fr)_minmax(220px,1.4fr)_120px]">
                <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Nombre del área" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-400" />
                <input value={newCategoryDescription} onChange={e => setNewCategoryDescription(e.target.value)} placeholder="Descripción opcional" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none focus:border-blue-400" />
                <input value={newCategoryStaff} onChange={e => setNewCategoryStaff(e.target.value)} placeholder="Asesores (separados por coma)" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400" />
                <button onClick={handleAddCategory} disabled={!newCategoryName.trim()} className="h-11 rounded-xl bg-slate-950 px-4 text-[10px] font-black uppercase tracking-wider text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">Agregar</button>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h4 className="text-xs font-black text-slate-900">Áreas configuradas</h4><span className="text-[10px] font-bold text-slate-400">{renderableCategories.length} áreas</span></div>
              <div className="divide-y divide-slate-100">
                {renderableCategories.map(category => (
                  <div 
                    key={category.id}
                    onClick={() => setSelectedStructureCategoryId(category.id)}
                    className={cn(
                      "group grid cursor-pointer gap-3 px-4 py-3 transition sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-center",
                      selectedStructureCategoryId === category.id 
                        ? "bg-blue-50" 
                        : "hover:bg-slate-50"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="h-4 w-4 shrink-0 text-blue-600" />
                        <h5 className="truncate text-sm font-black text-slate-900">{category.name}</h5>
                      </div>
                      {category.description && <p className="mt-0.5 truncate pl-6 text-xs text-slate-500">{category.description}</p>}
                      <div className="mt-2 pl-6 flex flex-wrap items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <Users className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="text-[10px] font-bold text-slate-400 mr-1">Personal auditado:</span>
                        {editingCategoryStaffId === category.id ? (
                          <div className="flex items-center gap-1.5 w-full max-w-md mt-1">
                            <input
                              type="text"
                              value={tempStaffInput}
                              onChange={(e) => setTempStaffInput(e.target.value)}
                              placeholder="Ej: Juan Perez, Maria Gomez"
                              className="h-8 flex-1 rounded-lg border border-blue-300 bg-white px-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newStaffList = tempStaffInput.split(',').map(s => s.trim()).filter(Boolean);
                                updateCategory(category.id, (cat) => ({ ...cat, staffOptions: newStaffList }));
                                setEditingCategoryStaffId(null);
                              }}
                              className="h-8 px-2.5 rounded-lg bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider hover:bg-blue-700"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCategoryStaffId(null)}
                              className="h-8 px-2 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold hover:bg-slate-200"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1">
                            {(category.staffOptions && category.staffOptions.length > 0) ? (
                              category.staffOptions.map((staff, sIdx) => (
                                <span key={sIdx} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200/60">
                                  {staff}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] italic text-slate-400">Sin colaboradores asignados</span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategoryStaffId(category.id);
                                setTempStaffInput((category.staffOptions || []).join(', '));
                              }}
                              className="ml-1 text-[10px] font-black text-blue-600 hover:text-blue-800 underline decoration-dotted"
                            >
                              Editar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{category.items.length} preguntas</span>
                    <div className="flex items-center justify-end gap-1"><button title="Duplicar área" onClick={(e) => { e.stopPropagation(); handleDuplicateCategory(category.id); }} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-blue-600"><Layers className="h-4 w-4" /></button><button title="Eliminar área" onClick={(e) => { e.stopPropagation(); handleDeleteCategory(category.id); }} className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button><button title="Ver preguntas" onClick={(e) => { e.stopPropagation(); setSelectedStructureCategoryId(category.id); setActiveTab("questions"); }} className="flex h-9 items-center gap-1 rounded-lg px-3 text-[10px] font-black uppercase text-blue-700 hover:bg-blue-100">Abrir <ChevronRight className="h-3.5 w-3.5" /></button></div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Tab: Questions */}
        {activeTab === "questions" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-right-4 duration-500">
             {/* Left: Category Info & Add Question */}
             <div className="lg:col-span-4 space-y-6">
                <div className="premium-card bg-white dark:bg-slate-900 border-white/5 p-6 shadow-xl">
                   <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">Categoría Activa</p>
                   <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase leading-none mb-6">
                      {selectedStructureCategory?.name || "Seleccione un área"}
                   </h3>
                   
                   <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nueva Pregunta</label>
                        <input 
                          value={newItemText}
                          onChange={e => setNewItemText(e.target.value)}
                          placeholder="Texto de la pregunta..." 
                          className="w-full mt-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      {isOrdersCategory && (
                        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <label className="block space-y-1.5"><span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Sector de la OR</span><select value={newItemSector} onChange={(event) => setNewItemSector(event.target.value as OrAuditSector)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-400">{Object.entries(sectorLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                          <div><p className="mb-2 text-[9px] font-black uppercase tracking-wider text-slate-500">Responsables del punto</p><div className="flex flex-wrap gap-1.5">{responsibleRoleOptions.map((role) => <button key={role.value} type="button" onClick={() => setNewItemResponsibleRoles((current) => current.includes(role.value) ? current.filter((value) => value !== role.value) : [...current, role.value])} className={cn("rounded-lg border px-2.5 py-2 text-[9px] font-black", newItemResponsibleRoles.includes(role.value) ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500")}>{role.label}</button>)}</div></div>
                        </div>
                      )}
                      <button 
                        onClick={handleAddItem}
                        className="w-full py-4 rounded-2xl bg-blue-600 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all"
                      >
                        Añadir a la lista
                      </button>
                   </div>
                </div>

                {/* Filters */}
                <div className="premium-card bg-white dark:bg-slate-900 border-white/5 p-6">
                   <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white mb-4">Filtrar Lista</h5>
                   <input 
                      value={itemSearch}
                      onChange={e => setItemSearch(e.target.value)}
                      placeholder="Buscar pregunta..." 
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 outline-none"
                   />
                   <div className="mt-4 flex items-center gap-2">
                      <button 
                        onClick={() => setShowOnlyActive(!showOnlyActive)}
                        className={cn(
                          "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                          showOnlyActive ? "bg-slate-900 dark:bg-blue-600 text-white" : "bg-slate-50 dark:bg-white/5 text-slate-400"
                        )}
                      >
                        Sólo Activas
                      </button>
                   </div>
                </div>
             </div>

             {/* Right: Question List */}
             <div className="lg:col-span-8">
                <div className="premium-card bg-white dark:bg-slate-900 border-white/5 overflow-hidden shadow-xl">
                   <div className="bg-slate-50 dark:bg-white/5 px-6 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Listado de ítems</span>
                      <span className="text-[10px] font-black text-slate-900 dark:text-white">{visibleStructureItems.length} ítems</span>
                   </div>
                   <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-[700px] overflow-y-auto custom-scrollbar">
                      {visibleStructureItems.map((item, idx) => (
                        <div key={item.id} className="p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                           <div className="flex items-start justify-between gap-4">
                              <div className="flex gap-4 min-w-0">
                                 <span className="text-xs font-black text-slate-300 dark:text-slate-700 mt-0.5">{(idx+1).toString().padStart(2, '0')}</span>
                                 <div className="space-y-2 min-w-0">
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-snug">{item.text}</p>
                                    <div className="flex flex-wrap gap-2">
                                       <span className={cn(
                                         "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                                         item.active === false ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                                       )}>
                                         {item.active === false ? "Inactivo" : "Activo"}
                                       </span>
                                       {item.block && (
                                         <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-500">
                                            {item.block}
                                         </span>
                                       )}
                                       {isOrdersCategory && item.sector && <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-indigo-600">{sectorLabels[item.sector]}</span>}
                                       {item.priority === 'high' && (
                                         <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-red-500/10 text-red-500">Crítico</span>
                                       )}
                                    </div>
                                    {isOrdersCategory && (
                                      <div className="space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-1.5"><span className="mr-1 text-[9px] font-black uppercase tracking-wider text-slate-400">Responsables</span>{responsibleRoleOptions.map((role) => { const assigned = item.responsibleRoles?.includes(role.value) ?? false; return <button key={role.value} type="button" onClick={() => handleToggleItemResponsibleRole(item.id, role.value)} className={cn("rounded-md border px-2 py-1 text-[9px] font-bold transition", assigned ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-400 hover:border-blue-300")}>{assigned ? "✓ " : "+ "}{role.label}</button>; })}</div>
                                        <div className="flex flex-wrap items-center gap-1.5"><span className="mr-1 text-[9px] font-black uppercase tracking-wider text-slate-400">Impacta en</span>{(item.scoreAreas?.length ? item.scoreAreas : []).map((area) => <span key={area} className="rounded-md bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700">{area}</span>)}{!item.scoreAreas?.length && <span className="text-[9px] font-medium text-slate-400">Sin regla de cálculo</span>}</div>
                                      </div>
                                    )}
                                 </div>
                              </div>
                              
                              <div className="flex items-center gap-1 shrink-0">
                                 <button 
                                   onClick={() => handleMoveItem(item.id, "up")}
                                   disabled={idx === 0}
                                   className="p-2 rounded-lg hover:bg-white dark:hover:bg-white/10 text-slate-400 hover:text-blue-500 disabled:opacity-0 transition-all"
                                 >
                                    <ArrowUp className="h-4 w-4" />
                                 </button>
                                 <button 
                                   onClick={() => handleMoveItem(item.id, "down")}
                                   disabled={idx === visibleStructureItems.length - 1}
                                   className="p-2 rounded-lg hover:bg-white dark:hover:bg-white/10 text-slate-400 hover:text-blue-500 disabled:opacity-0 transition-all"
                                 >
                                    <ArrowDown className="h-4 w-4" />
                                 </button>
                                 <div className="w-[1px] h-6 bg-slate-100 dark:bg-white/10 mx-1" />
                                 <button 
                                   onClick={() => handleDeleteItem(selectedStructureCategoryId, item.id)}
                                   className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-all"
                                 >
                                    <Trash2 className="h-4 w-4" />
                                 </button>
                              </div>
                           </div>
                        </div>
                      ))}
                      {visibleStructureItems.length === 0 && (
                        <div className="py-20 text-center">
                           <Info className="h-10 w-10 text-slate-200 mx-auto mb-4" />
                           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No hay preguntas cargadas</p>
                        </div>
                      )}
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* Tab: Matrix (Advanced Links) */}
        {activeTab === "matrix" && (
          <div className="animate-in zoom-in-95 duration-500">
             <div className="premium-card bg-white dark:bg-slate-900 border-white/5 p-8 shadow-2xl">
                <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
                   <div className="space-y-1">
                      <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Matriz de Vínculos de Calidad</h4>
                      <p className="text-xs font-medium text-slate-500 leading-relaxed">
                        Cada tilde agrega esa pregunta al promedio automático de la pregunta destino.
                        <br />
                        <span className="text-blue-600 dark:text-blue-400 font-bold">Google Sheets:</span> los vínculos se leen y se guardan en la hoja Reglas de cálculo.
                      </p>
                   </div>
                   
                   <div className="flex items-center gap-4 bg-slate-50 dark:bg-white/5 p-3 rounded-2xl border border-slate-200 dark:border-white/5">
                      <div className="space-y-1">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Origen</p>
                         <select 
                            value={selectedSourceAreaName}
                            onChange={e => setSelectedSourceAreaName(e.target.value)}
                            className="bg-transparent text-sm font-black text-slate-900 dark:text-white outline-none min-w-[120px]"
                         >
                            <option value="">Seleccionar...</option>
                            {renderableCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                         </select>
                      </div>
                      <div className="w-[1px] h-8 bg-slate-200 dark:bg-white/10" />
                      <div className="space-y-1">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Destino</p>
                         <select 
                            value={selectedTargetAreaName}
                            onChange={e => setSelectedTargetAreaName(e.target.value)}
                            className="bg-transparent text-sm font-black text-slate-900 dark:text-white outline-none min-w-[120px]"
                         >
                            <option value="">Seleccionar...</option>
                            {renderableCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                         </select>
                      </div>
                   </div>
                </div>

                <div className="overflow-x-auto border border-slate-100 dark:border-white/5 rounded-2xl custom-scrollbar bg-slate-50/50 dark:bg-black/20">
                  {sourceMatrixItems.length > 0 && targetMatrixItems.length > 0 ? (
                    <table className="w-full border-collapse">
                       <thead>
                          <tr className="bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                             <th className="p-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[320px] sticky left-0 bg-slate-100 dark:bg-slate-900 z-10">Origen \ Destino</th>
                             {targetMatrixItems.map((item, i) => (
                               <th key={item.id} className="p-6 text-center min-w-[200px] border-l border-slate-200 dark:border-white/5">
                                  <div className="flex flex-col items-center gap-3">
                                     <span className="h-8 w-8 rounded-full bg-slate-900 dark:bg-blue-600 text-[11px] font-black text-white flex items-center justify-center shadow-lg">{i+1}</span>
                                     <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-tight leading-tight break-words max-w-[180px]">
                                       {item.text}
                                     </span>
                                  </div>
                               </th>
                             ))}
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                          {sourceMatrixItems.map((source, r) => (
                            <tr key={source.id} className="hover:bg-white dark:hover:bg-white/5 transition-colors">
                               <td className="p-6 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-[4px_0_12px_rgba(0,0,0,0.02)]">
                                  <div className="flex items-start gap-4">
                                     <span className="text-[11px] font-black text-slate-300 dark:text-slate-700 mt-0.5">{(r+1).toString().padStart(2, '0')}</span>
                                     <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 leading-snug">{source.text}</p>
                                  </div>
                               </td>
                               {targetMatrixItems.map(target => {
                                  const isLinked = calculationRules.some((rule) => (
                                    rule.active
                                    && rule.scope === selectedStructureScope
                                    && rule.sourceArea === selectedSourceAreaName
                                    && rule.sourceItemId === source.id
                                    && rule.targetArea === selectedTargetAreaName
                                    && rule.targetItemId === target.id
                                  )) || source.scoreLinks?.some((link) => (
                                    link.area === selectedTargetAreaName && link.destinationItemId === target.id
                                  ));
                                  return (
                                    <td key={target.id} className="p-6 text-center border-l border-slate-100 dark:border-white/5">
                                       <button 
                                         onClick={() => handleToggleCalculationLink({
                                           sourceArea: selectedSourceAreaName,
                                           sourceItemId: source.id,
                                           targetArea: selectedTargetAreaName,
                                           targetItemId: target.id,
                                         })}
                                         title={isLinked ? "Quitar del promedio" : "Agregar al promedio"}
                                         aria-label={`${isLinked ? "Quitar" : "Agregar"} vínculo entre preguntas`}
                                         className={cn(
                                           "h-14 w-14 mx-auto rounded-[1.2rem] border-2 transition-all flex items-center justify-center text-lg",
                                           isLinked 
                                            ? "bg-emerald-500 border-emerald-400 text-white shadow-xl shadow-emerald-500/30 scale-110" 
                                            : "bg-white dark:bg-white/5 border-slate-100 dark:border-white/5 text-slate-200 hover:border-emerald-500/50 hover:text-emerald-500 hover:bg-emerald-50/50"
                                         )}
                                       >
                                          {isLinked ? "✓" : "·"}
                                       </button>
                                    </td>
                                  );
                               })}
                            </tr>
                          ))}
                       </tbody>
                    </table>
                  ) : (
                    <div className="py-24 text-center">
                       <Link2 className="h-12 w-12 text-slate-200 mx-auto mb-4 animate-pulse" />
                       <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Seleccione áreas de origen y destino para vincular</p>
                    </div>
                  )}
                </div>
             </div>
          </div>
        )}

      </div>
    </div>
  );
}
