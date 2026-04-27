import { useEffect, useState } from "react";
import { 
  ArrowDown, 
  ArrowUp, 
  FolderKanban, 
  Link2, 
  ListChecks, 
  PlusCircle, 
  Settings2, 
  Trash2,
  ChevronRight,
  Info,
  Layers,
  Database
} from "lucide-react";
import { cn } from "../../lib/utils";
import {
  AuditCategory,
  AuditItemPriority,
  AuditStructureScope,
  OrAuditSector,
  OrResponsibleRole,
} from "../../types";

interface StructurePanelProps {
  selectedStructureScope: AuditStructureScope;
  setSelectedStructureScope: (scope: AuditStructureScope) => void;
  structureStorageLabel: "local" | "cloud";
  isLoadingStructureFromCloud: boolean;
  isSavingStructureToCloud: boolean;
  handleLoadStructureFromCloud: () => void;
  handleSaveStructureToCloud: () => void;
  handleResetStructure: () => void;
  auditCategories: AuditCategory[];
  selectedStructureCategory: AuditCategory | null;
  selectedStructureCategoryId: string;
  setSelectedStructureCategoryId: (categoryId: string) => void;
  updateCategory: (categoryId: string, updater: (category: AuditCategory) => AuditCategory) => void;
  handleDuplicateCategory: (categoryId: string) => void;
  handleDeleteCategory: (categoryId: string) => void;
  handleDuplicateItem: (categoryId: string, itemId: string) => void;
  handleDeleteItem: (categoryId: string, itemId: string) => void;
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
  lastStructureSavedAt: string | null;
}

type TabType = "categories" | "questions" | "matrix";

export function StructurePanel({
  selectedStructureScope,
  setSelectedStructureScope,
  auditCategories,
  selectedStructureCategory,
  selectedStructureCategoryId,
  setSelectedStructureCategoryId,
  updateCategory,
  handleDuplicateCategory,
  handleDeleteCategory,
  handleDuplicateItem,
  handleDeleteItem,
  newCategoryName,
  setNewCategoryName,
  newCategoryDescription,
  setNewCategoryDescription,
  newCategoryStaff,
  setNewCategoryStaff,
  handleAddCategory,
  newItemText,
  setNewItemText,
  handleAddItem,
  handleMoveItem,
  lastStructureSavedAt,
  handleSaveStructureToCloud,
  handleLoadStructureFromCloud,
  isSavingStructureToCloud,
  isLoadingStructureFromCloud
}: StructurePanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("categories");
  const [selectedScoreItemId, setSelectedScoreItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [selectedSourceAreaName, setSelectedSourceAreaName] = useState("");
  const [selectedTargetAreaName, setSelectedTargetAreaName] = useState("");
  
  const savedLabel = lastStructureSavedAt
    ? new Date(lastStructureSavedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : null;

  // Auto-select category if none selected
  useEffect(() => {
    if (!selectedStructureCategory && auditCategories.length > 0) {
      setSelectedStructureCategoryId(auditCategories[0].id);
    }
  }, [auditCategories, selectedStructureCategory, setSelectedStructureCategoryId]);

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

  const sourceMatrixItems = auditCategories.find(c => c.name === selectedSourceAreaName)?.items ?? [];
  const targetMatrixItems = auditCategories.find(c => c.name === selectedTargetAreaName)?.items ?? [];

  const toggleMatrixCell = (sourceItemId: string, destinationItemId: string) => {
    const sourceCategory = auditCategories.find(c => c.name === selectedSourceAreaName);
    const targetCategory = auditCategories.find(c => c.name === selectedTargetAreaName);
    if (!sourceCategory || !targetCategory) return;

    const sourceItem = sourceCategory.items.find(i => i.id === sourceItemId);
    const destinationItem = targetCategory.items.find(i => i.id === destinationItemId);
    if (!sourceItem || !destinationItem) return;

    updateCategory(sourceCategory.id, (category) => ({
      ...category,
      items: category.items.map((item) => {
        if (item.id !== sourceItemId) return item;
        const currentLinks = Array.isArray(item.scoreLinks) ? item.scoreLinks : [];
        const hasLink = currentLinks.some(l => l.area === targetCategory.name && l.destinationItemId === destinationItemId);
        const nextLinks = hasLink
          ? currentLinks.filter(l => !(l.area === targetCategory.name && l.destinationItemId === destinationItemId))
          : [...currentLinks, { area: targetCategory.name, weight: 100, destinationItemId, destinationItemText: destinationItem.text }];
        return { ...item, scoreLinks: nextLinks, scoreAreas: nextLinks.map(l => l.area) };
      }),
    }));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Gestión de Estructura</h2>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
             Configure áreas, preguntas y vínculos inteligentes
             {savedLabel && <span className="text-emerald-500">? Último guardado: {savedLabel}</span>}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <button 
            onClick={handleSaveStructureToCloud}
            disabled={isSavingStructureToCloud}
            className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 dark:bg-blue-600 text-[11px] font-black uppercase tracking-widest text-white shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            <Database className="h-4 w-4" />
            {isSavingStructureToCloud ? "Guardando..." : "Sincronizar Nube"}
          </button>
          <div className="h-10 w-[1px] bg-slate-200 dark:bg-white/10 hidden lg:block" />
          <div className="flex bg-slate-100 dark:bg-white/5 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5">
             {(["global", "Salta", "Jujuy"] as AuditStructureScope[]).map((scope) => (
               <button
                 key={scope}
                 onClick={() => setSelectedStructureScope(scope)}
                 className={cn(
                   "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                   selectedStructureScope === scope 
                    ? "bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm" 
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
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 p-1.5 rounded-3xl w-fit border border-slate-200 dark:border-white/5">
        <button 
          onClick={() => setActiveTab("categories")}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all",
            activeTab === "categories" ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-md" : "text-slate-500"
          )}
        >
          <FolderKanban className="h-4 w-4" /> Categorías
        </button>
        <button 
          onClick={() => setActiveTab("questions")}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all",
            activeTab === "questions" ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-md" : "text-slate-500"
          )}
        >
          <ListChecks className="h-4 w-4" /> Preguntas
        </button>
        <button 
          onClick={() => setActiveTab("matrix")}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all",
            activeTab === "matrix" ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-md" : "text-slate-500"
          )}
        >
          <Link2 className="h-4 w-4" /> Vínculos
        </button>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 gap-6 min-h-[600px]">
        
        {/* Tab: Categories */}
        {activeTab === "categories" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-left-4 duration-500">
            <div className="lg:col-span-4 space-y-6">
              <div className="premium-card bg-white dark:bg-slate-900 border-white/5 p-6 shadow-xl">
                 <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                   <PlusCircle className="h-4 w-4 text-emerald-500" /> Nueva Área
                 </h4>
                 <div className="space-y-4">
                    <input 
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      placeholder="Nombre del Área (Ej: Lavadero)" 
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <textarea 
                      value={newCategoryDescription}
                      onChange={e => setNewCategoryDescription(e.target.value)}
                      placeholder="Descripción breve..." 
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl px-5 py-4 text-sm font-medium text-slate-600 dark:text-slate-400 h-24 outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button 
                      onClick={handleAddCategory}
                      className="w-full py-4 rounded-2xl bg-emerald-600 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      Crear Área
                    </button>
                 </div>
              </div>

              <div className="p-6 rounded-3xl bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-start gap-3">
                   <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                   <div>
                     <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1">Información</p>
                     <p className="text-xs font-medium text-slate-500 leading-relaxed">
                       Las categorías definen los sectores del negocio. Puedes duplicar una categoría existente para usarla como base en otra sucursal.
                     </p>
                   </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {auditCategories.map(category => (
                  <div 
                    key={category.id}
                    onClick={() => setSelectedStructureCategoryId(category.id)}
                    className={cn(
                      "group premium-card p-6 cursor-pointer transition-all border border-white/5",
                      selectedStructureCategoryId === category.id 
                        ? "bg-slate-900 dark:bg-white ring-4 ring-blue-500/20" 
                        : "bg-white dark:bg-slate-900 hover:border-blue-500/50"
                    )}
                  >
                    <div className="flex items-start justify-between mb-4">
                       <div className={cn(
                         "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors",
                         selectedStructureCategoryId === category.id 
                          ? "bg-white/10 text-white dark:bg-slate-900/5 dark:text-slate-900" 
                          : "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                       )}>
                          <FolderKanban className="h-6 w-6" />
                       </div>
                       <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDuplicateCategory(category.id); }}
                            className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-blue-500 transition-colors"
                          >
                             <Layers className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteCategory(category.id); }}
                            className="p-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-400 hover:text-red-500 transition-colors"
                          >
                             <Trash2 className="h-4 w-4" />
                          </button>
                       </div>
                    </div>
                    <h5 className={cn(
                      "text-lg font-black uppercase tracking-tight",
                      selectedStructureCategoryId === category.id ? "text-white dark:text-slate-900" : "text-slate-900 dark:text-white"
                    )}>
                      {category.name}
                    </h5>
                    <p className={cn(
                      "text-xs font-medium mt-1 line-clamp-2",
                      selectedStructureCategoryId === category.id ? "text-slate-400 dark:text-slate-500" : "text-slate-400"
                    )}>
                      {category.description || "Sin descripción"}
                    </p>
                    <div className="mt-6 flex items-center justify-between">
                       <span className={cn(
                         "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg",
                         selectedStructureCategoryId === category.id 
                          ? "bg-white/10 text-white dark:bg-slate-900/5 dark:text-slate-900" 
                          : "bg-slate-50 dark:bg-white/5 text-slate-500"
                       )}>
                         {category.items.length} Preguntas
                       </span>
                       <ChevronRight className={cn(
                         "h-5 w-5 transition-transform group-hover:translate-x-1",
                         selectedStructureCategoryId === category.id ? "text-white dark:text-slate-900" : "text-slate-300"
                       )} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
                                       {item.priority === 'high' && (
                                         <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-red-500/10 text-red-500">Crítico</span>
                                       )}
                                    </div>
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
                      <p className="text-xs font-medium text-slate-500">
                        Defina cómo el resultado de un área impacta automáticamente en otra (vínculos en cascada).
                      </p>
                   </div>
                   
                   <div className="flex items-center gap-4 bg-slate-50 dark:bg-white/5 p-3 rounded-2xl border border-slate-200 dark:border-white/5">
                      <div className="space-y-1">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Origen</p>
                         <select 
                            value={selectedSourceAreaName}
                            onChange={e => setSelectedSourceAreaName(e.target.value)}
                            className="bg-transparent text-sm font-black text-slate-900 dark:text-white outline-none"
                         >
                            <option value="">Seleccionar...</option>
                            {auditCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                         </select>
                      </div>
                      <div className="w-[1px] h-8 bg-slate-200 dark:bg-white/10" />
                      <div className="space-y-1">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Destino</p>
                         <select 
                            value={selectedTargetAreaName}
                            onChange={e => setSelectedTargetAreaName(e.target.value)}
                            className="bg-transparent text-sm font-black text-slate-900 dark:text-white outline-none"
                         >
                            <option value="">Seleccionar...</option>
                            {auditCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                         </select>
                      </div>
                   </div>
                </div>

                <div className="overflow-x-auto border border-slate-100 dark:border-white/5 rounded-2xl">
                  {sourceMatrixItems.length > 0 && targetMatrixItems.length > 0 ? (
                    <table className="w-full border-collapse">
                       <thead>
                          <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                             <th className="p-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-1/3">Origen \ Destino</th>
                             {targetMatrixItems.map((item, i) => (
                               <th key={item.id} className="p-4 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                     <span className="h-6 w-6 rounded-full bg-slate-900 dark:bg-blue-600 text-[10px] font-black text-white flex items-center justify-center">{i+1}</span>
                                     <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter truncate max-w-[80px]">{item.text}</span>
                                  </div>
                               </th>
                             ))}
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {sourceMatrixItems.map((source, r) => (
                            <tr key={source.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                               <td className="p-4">
                                  <div className="flex items-start gap-3">
                                     <span className="text-[10px] font-black text-slate-300 mt-0.5">{(r+1).toString().padStart(2, '0')}</span>
                                     <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-tight">{source.text}</p>
                                  </div>
                               </td>
                               {targetMatrixItems.map(target => {
                                  const isLinked = source.scoreLinks?.some(l => l.area === selectedTargetAreaName && l.destinationItemId === target.id);
                                  return (
                                    <td key={target.id} className="p-2 text-center">
                                       <button 
                                         onClick={() => toggleMatrixCell(source.id, target.id)}
                                         className={cn(
                                           "h-10 w-10 rounded-xl border transition-all flex items-center justify-center text-xs",
                                           isLinked 
                                            ? "bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20" 
                                            : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-300 hover:border-emerald-500/50"
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
                       <Link2 className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                       <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Seleccione área de origen y destino para vincular</p>
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
