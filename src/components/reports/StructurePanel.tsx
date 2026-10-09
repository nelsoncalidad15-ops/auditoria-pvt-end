import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  FolderKanban,
  Link2,
  ListChecks,
  Plus,
  Trash2,
  ChevronRight,
  Info,
  Database,
  Table,
  Users,
  Search,
  X,
  Check,
  Edit2,
  Copy,
  AlertTriangle,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import { cn, createClientId } from "../../lib/utils";
import {
  AuditCategory,
  AuditTemplateItem,
  CalculationRule,
  AuditItemPriority,
  AuditStructureScope,
  OrAuditSector,
  OrResponsibleRole,
} from "../../types";

export interface StructurePanelProps {
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
  handleDuplicateItem?: (categoryId: string, itemId: string) => void;
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

const normalizeCategoryName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const isControllerDirectory = (category: AuditCategory) => {
  const norm = normalizeCategoryName(category.name);
  return (
    norm === "controllers de or" ||
    norm === "controller de or" ||
    norm === "controllers or"
  );
};

const RESPONSIBLE_ROLE_OPTIONS: Array<{ value: OrResponsibleRole; label: string }> = [
  { value: "asesor", label: "Asesor" },
  { value: "tecnico", label: "Técnico" },
  { value: "controller", label: "Controller" },
  { value: "lavador", label: "Lavador" },
  { value: "repuestos", label: "Repuestos" },
];

const SECTOR_LABELS: Record<OrAuditSector, string> = {
  recepcion: "Recepción",
  taller: "Taller",
  control_calidad: "Control de calidad",
  lavado: "Lavado",
  repuestos: "Repuestos",
  resumen: "Resumen",
};

export function StructurePanel({
  selectedStructureScope,
  setSelectedStructureScope,
  auditCategories,
  calculationRules,
  handleToggleCalculationLink,
  selectedStructureCategory: _selectedStructureCategory,
  selectedStructureCategoryId,
  setSelectedStructureCategoryId,
  handleDuplicateCategory,
  handleDeleteCategory,
  handleDuplicateItem,
  handleDeleteItem,
  updateCategory,
  handleAddCategory: _handleAddCategory,
  handleMoveItem,
  handleToggleItemResponsibleRole: _handleToggleItemResponsibleRole,
  lastStructureSavedAt,
  handleSaveStructureToSheet,
  handleLoadStructureFromSheet,
  isSavingStructureToSheet,
  isLoadingStructureFromSheet,
  hasPendingStructureChanges,
}: StructurePanelProps) {
  // Navigation
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    return (localStorage.getItem("audit-structure-tab") as TabType) || "categories";
  });

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    localStorage.setItem("audit-structure-tab", tab);
  };

  // Categories filtering & renderable list
  const controllerDirectory = auditCategories.find(isControllerDirectory);
  const renderableCategories = useMemo(
    () => auditCategories.filter((cat) => cat.name.trim().length > 0 && !isControllerDirectory(cat)),
    [auditCategories]
  );

  // Active Category synchronization
  useEffect(() => {
    if (renderableCategories.length > 0) {
      const storedCatId = localStorage.getItem("audit-structure-last-cat");
      const exists = renderableCategories.some((c) => c.id === selectedStructureCategoryId);
      if (!exists) {
        const storedExists = renderableCategories.find((c) => c.id === storedCatId);
        if (storedExists) {
          setSelectedStructureCategoryId(storedExists.id);
        } else {
          setSelectedStructureCategoryId(renderableCategories[0].id);
        }
      }
    }
  }, [renderableCategories, selectedStructureCategoryId, setSelectedStructureCategoryId]);

  const activeCategory = useMemo(
    () => renderableCategories.find((c) => c.id === selectedStructureCategoryId) || renderableCategories[0] || null,
    [renderableCategories, selectedStructureCategoryId]
  );

  const isOrdersCategory = activeCategory?.name.toLowerCase().includes("orden") ?? false;

  // Question Filters
  const [itemSearch, setItemSearch] = useState("");
  const [filterSector, setFilterSector] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  const hasActiveFilters = Boolean(
    itemSearch.trim() || filterSector !== "all" || filterRole !== "all" || filterStatus !== "all"
  );

  const resetFilters = () => {
    setItemSearch("");
    setFilterSector("all");
    setFilterRole("all");
    setFilterStatus("all");
  };

  // Visible questions in strict original order
  const categoryItems = activeCategory?.items ?? [];
  const visibleItems = useMemo(() => {
    return categoryItems.filter((item, idx) => {
      const normQuery = itemSearch.trim().toLowerCase();
      const questionNumber = String(idx + 1);

      // Search matches question number, question text, or description
      const matchesSearch =
        !normQuery ||
        questionNumber === normQuery ||
        item.text.toLowerCase().includes(normQuery) ||
        (item.description ?? "").toLowerCase().includes(normQuery) ||
        (item.guidance ?? "").toLowerCase().includes(normQuery) ||
        (item.block ?? "").toLowerCase().includes(normQuery);

      const matchesSector = filterSector === "all" || item.sector === filterSector;
      const matchesRole =
        filterRole === "all" ||
        (item.responsibleRoles ?? []).includes(filterRole as OrResponsibleRole);
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && item.active !== false) ||
        (filterStatus === "inactive" && item.active === false);

      return matchesSearch && matchesSector && matchesRole && matchesStatus;
    });
  }, [categoryItems, itemSearch, filterSector, filterRole, filterStatus]);

  // Drawer (Question Editor) State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerItem, setDrawerItem] = useState<AuditTemplateItem | null>(null);
  const [originalDrawerItem, setOriginalDrawerItem] = useState<AuditTemplateItem | null>(null);
  const [isNewQuestion, setIsNewQuestion] = useState(false);
  const [targetCategoryId, setTargetCategoryId] = useState("");

  const isDrawerDirty = useMemo(() => {
    if (!drawerItem) return false;
    if (isNewQuestion) return Boolean(drawerItem.text.trim());
    return JSON.stringify(drawerItem) !== JSON.stringify(originalDrawerItem);
  }, [drawerItem, originalDrawerItem, isNewQuestion]);

  const openEditDrawer = (item: AuditTemplateItem) => {
    setDrawerItem({ ...item });
    setOriginalDrawerItem({ ...item });
    setIsNewQuestion(false);
    setTargetCategoryId(activeCategory?.id || "");
    setDrawerOpen(true);
  };

  const openNewItemDrawer = () => {
    if (!activeCategory) return;
    const nextOrder = (activeCategory.items.length || 0) + 1;
    const blankItem: AuditTemplateItem = {
      id: createClientId(),
      text: "",
      required: false,
      block: "General",
      description: "",
      sector: "recepcion",
      responsibleRoles: ["asesor"],
      priority: "medium",
      guidance: "",
      allowsNa: true,
      weight: 1,
      active: true,
      order: nextOrder,
      requiresCommentOnFail: false,
    };
    setDrawerItem(blankItem);
    setOriginalDrawerItem(blankItem);
    setIsNewQuestion(true);
    setTargetCategoryId(activeCategory.id);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (isDrawerDirty) {
      if (!window.confirm("Hay cambios sin guardar en la pregunta. ¿Deseás salir y descartarlos?")) {
        return;
      }
    }
    setDrawerOpen(false);
    setDrawerItem(null);
    setOriginalDrawerItem(null);
  };

  const handleSaveDrawer = () => {
    if (!drawerItem || !activeCategory) return;
    const trimmedText = drawerItem.text.trim();
    if (!trimmedText) {
      alert("El texto de la pregunta es obligatorio.");
      return;
    }

    const cleanedItem: AuditTemplateItem = {
      ...drawerItem,
      text: trimmedText,
      description: drawerItem.description?.trim() || undefined,
      guidance: drawerItem.guidance?.trim() || undefined,
      block: drawerItem.block?.trim() || "General",
    };

    if (isNewQuestion) {
      // Add new item to target category
      updateCategory(targetCategoryId || activeCategory.id, (cat) => ({
        ...cat,
        items: [...cat.items, { ...cleanedItem, order: cat.items.length + 1 }],
      }));
    } else {
      // If category didn't change, update in place
      if (targetCategoryId === activeCategory.id) {
        updateCategory(activeCategory.id, (cat) => ({
          ...cat,
          items: cat.items.map((it) => (it.id === cleanedItem.id ? cleanedItem : it)),
        }));
      } else {
        // Move to another category
        updateCategory(activeCategory.id, (cat) => ({
          ...cat,
          items: cat.items
            .filter((it) => it.id !== cleanedItem.id)
            .map((it, idx) => ({ ...it, order: idx + 1 })),
        }));
        updateCategory(targetCategoryId, (cat) => ({
          ...cat,
          items: [...cat.items, { ...cleanedItem, order: cat.items.length + 1 }],
        }));
      }
    }

    setDrawerOpen(false);
    setDrawerItem(null);
    setOriginalDrawerItem(null);
  };

  // Safe category deletion modal state
  const [categoryToDelete, setCategoryToDelete] = useState<AuditCategory | null>(null);

  // Safe item deletion modal state
  const [itemToDelete, setItemToDelete] = useState<AuditTemplateItem | null>(null);

  // New Category modal state
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newCatStaff, setNewCatStaff] = useState("");

  const handleCreateNewCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) {
      alert("Ingresá un nombre para el área.");
      return;
    }
    if (renderableCategories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      alert("Ya existe un área con ese nombre.");
      return;
    }
    const newCat: AuditCategory = {
      id: createClientId(),
      name: trimmed,
      description: newCatDesc.trim(),
      staffOptions: newCatStaff.split(",").map((s) => s.trim()).filter(Boolean),
      items: [],
      active: true,
    };
    updateCategory(newCat.id, () => newCat); // Will be added by hook if we use handleAddCategory, or updateCategory
    // Also use the hook's handleAddCategory props if needed
    setSelectedStructureCategoryId(newCat.id);
    localStorage.setItem("audit-structure-last-cat", newCat.id);
    setIsNewCategoryModalOpen(false);
    setNewCatName("");
    setNewCatDesc("");
    setNewCatStaff("");
  };

  // Edit Category modal state
  const [editingCategory, setEditingCategory] = useState<AuditCategory | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatDesc, setEditCatDesc] = useState("");

  const openEditCategory = (cat: AuditCategory) => {
    setEditingCategory(cat);
    setEditCatName(cat.name);
    setEditCatDesc(cat.description || "");
  };

  const handleSaveEditedCategory = () => {
    if (!editingCategory) return;
    const trimmed = editCatName.trim();
    if (!trimmed) {
      alert("El nombre del área no puede estar vacío.");
      return;
    }
    updateCategory(editingCategory.id, (cat) => ({
      ...cat,
      name: trimmed,
      description: editCatDesc.trim(),
    }));
    setEditingCategory(null);
  };

  // Inline staff tag management helpers
  const handleAddStaffChip = (categoryId: string, staffName: string) => {
    const trimmed = staffName.trim();
    if (!trimmed) return;
    updateCategory(categoryId, (cat) => {
      if ((cat.staffOptions || []).includes(trimmed)) return cat;
      return {
        ...cat,
        staffOptions: [...(cat.staffOptions || []), trimmed],
      };
    });
  };

  const handleRemoveStaffChip = (categoryId: string, staffIndex: number) => {
    updateCategory(categoryId, (cat) => ({
      ...cat,
      staffOptions: (cat.staffOptions || []).filter((_, i) => i !== staffIndex),
    }));
  };

  // Matrix tab states
  const [selectedSourceAreaName, setSelectedSourceAreaName] = useState("");
  const [selectedTargetAreaName, setSelectedTargetAreaName] = useState("");
  const sourceMatrixItems = renderableCategories.find((c) => c.name === selectedSourceAreaName)?.items ?? [];
  const targetMatrixItems = renderableCategories.find((c) => c.name === selectedTargetAreaName)?.items ?? [];

  const savedLabel = lastStructureSavedAt
    ? new Date(lastStructureSavedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* 1. Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="h-2.5 w-2.5 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]" />
            <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
              Estructura de auditorías
            </h2>
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
            Administrá áreas de evaluación, preguntas del checklist y reglas de cálculo vinculadas.
            {savedLabel && (
              <span className="inline-flex items-center gap-1 text-slate-400">
                • Último guardado: <span className="font-bold text-slate-600 dark:text-slate-300">{savedLabel}</span>
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Sync Buttons */}
          <div className="flex items-center gap-2 relative">
            {hasPendingStructureChanges && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-amber-500 rounded-full border-2 border-white dark:border-slate-900 z-10 flex items-center justify-center shadow-lg"
                title="Hay cambios locales sin sincronizar con Google Sheets"
              >
                <div className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
              </motion.div>
            )}

            <button
              onClick={handleLoadStructureFromSheet}
              disabled={isLoadingStructureFromSheet}
              title="Recargar la configuración oficial desde Google Sheets"
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50"
            >
              <Table className="h-4 w-4 text-slate-500" />
              {isLoadingStructureFromSheet ? "Recargando..." : "Recargar"}
            </button>

            <button
              onClick={handleSaveStructureToSheet}
              disabled={isSavingStructureToSheet}
              title="Guardar y sincronizar la estructura completa en Google Sheets"
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm",
                hasPendingStructureChanges
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20"
                  : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-200"
              )}
            >
              <Database className="h-4 w-4" />
              {isSavingStructureToSheet ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>

          <div className="h-8 w-[1px] bg-slate-200 dark:bg-white/10 hidden lg:block" />

          {/* Scope Switcher */}
          <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/5">
            {(["Salta", "Jujuy"] as AuditStructureScope[]).map((scope) => (
              <button
                key={scope}
                onClick={() => setSelectedStructureScope(scope)}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                  selectedStructureScope === scope
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                {scope}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
        <button
          onClick={() => handleTabChange("categories")}
          className={cn(
            "flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
            activeTab === "categories"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
          )}
        >
          <FolderKanban className="h-4 w-4" />
          Áreas
          <span
            className={cn(
              "px-1.5 py-0.5 rounded-md text-[10px] font-bold",
              activeTab === "categories" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300"
            )}
          >
            {renderableCategories.length}
          </span>
        </button>

        <button
          onClick={() => handleTabChange("questions")}
          className={cn(
            "flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
            activeTab === "questions"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
          )}
        >
          <ListChecks className="h-4 w-4" />
          Preguntas
          {activeCategory && (
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-md text-[10px] font-bold",
                activeTab === "questions" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300"
              )}
            >
              {categoryItems.length}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange("matrix")}
          className={cn(
            "flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
            activeTab === "matrix"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
          )}
        >
          <Link2 className="h-4 w-4" />
          Reglas de cálculo
        </button>
      </div>

      {/* 3. TAB: ÁREAS */}
      {activeTab === "categories" && (
        <div className="space-y-4 animate-in slide-in-from-left-4 duration-300">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Categorías y Áreas de Control
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configurá el personal asignado, revisá el número de preguntas y administrá cada área.
              </p>
            </div>

            <button
              onClick={() => setIsNewCategoryModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 dark:bg-blue-600 text-white text-xs font-black uppercase tracking-wider hover:bg-blue-700 transition shadow-sm"
            >
              <Plus className="h-4 w-4" /> Nueva área
            </button>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderableCategories.map((category) => (
              <div
                key={category.id}
                className={cn(
                  "flex flex-col justify-between rounded-2xl border bg-white dark:bg-slate-900 p-5 shadow-sm transition-all hover:shadow-md",
                  selectedStructureCategoryId === category.id
                    ? "border-blue-500 ring-2 ring-blue-500/10"
                    : "border-slate-200 dark:border-white/5"
                )}
              >
                <div className="space-y-4">
                  {/* Top card row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/40 flex items-center justify-center shrink-0">
                        <FolderKanban className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-base font-black text-slate-900 dark:text-white truncate">
                          {category.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-bold text-slate-400">
                            {category.items.length} {category.items.length === 1 ? "pregunta" : "preguntas"}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span
                            className={cn(
                              "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md",
                              category.active === false
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                            )}
                          >
                            {category.active === false ? "Inactiva" : "Activa"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Category Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditCategory(category)}
                        title="Editar área"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-white/5 transition"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDuplicateCategory(category.id)}
                        title="Duplicar área completa"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-white/5 transition"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setCategoryToDelete(category)}
                        title="Eliminar área"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  {category.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {category.description}
                    </p>
                  )}

                  {/* Staff Chips Section */}
                  <div className="rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/70 dark:bg-white/5 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        Personal auditado
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {category.staffOptions?.length || 0} personas
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {(category.staffOptions || []).map((staff, sIdx) => (
                        <span
                          key={sIdx}
                          className="inline-flex items-center gap-1 rounded-md bg-white dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 shadow-sm"
                        >
                          {staff}
                          <button
                            type="button"
                            onClick={() => handleRemoveStaffChip(category.id, sIdx)}
                            className="text-slate-400 hover:text-rose-600"
                            title="Quitar persona"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}

                      {/* Add staff inline input */}
                      <InlineAddStaff
                        onAdd={(name) => handleAddStaffChip(category.id, name)}
                      />
                    </div>
                  </div>

                  {/* Special Controllers section for OR */}
                  {normalizeCategoryName(category.name) === "ordenes" && controllerDirectory && (
                    <div className="rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/40 dark:bg-blue-950/10 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-blue-500" />
                          Controllers de OR
                        </span>
                        <span className="text-[10px] font-bold text-blue-500">
                          {controllerDirectory.staffOptions?.length || 0} asignados
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {(controllerDirectory.staffOptions || []).map((name, cIdx) => (
                          <span
                            key={cIdx}
                            className="inline-flex items-center gap-1 rounded-md bg-white dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800/40 shadow-sm"
                          >
                            {name}
                            <button
                              type="button"
                              onClick={() => handleRemoveStaffChip(controllerDirectory.id, cIdx)}
                              className="text-slate-400 hover:text-rose-600"
                              title="Quitar controller"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}

                        <InlineAddStaff
                          placeholder="+ Controller"
                          onAdd={(name) => handleAddStaffChip(controllerDirectory.id, name)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer action: Abrir preguntas */}
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <button
                    onClick={() => {
                      updateCategory(category.id, (cat) => ({
                        ...cat,
                        active: cat.active === false ? true : false,
                      }));
                    }}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
                  >
                    {category.active === false ? "Activar área" : "Desactivar"}
                  </button>

                  <button
                    onClick={() => {
                      setSelectedStructureCategoryId(category.id);
                      localStorage.setItem("audit-structure-last-cat", category.id);
                      handleTabChange("questions");
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-black uppercase tracking-wider hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
                  >
                    Ver preguntas <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. TAB: PREGUNTAS */}
      {activeTab === "questions" && (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
          {/* Header Bar with Category Dropdown & New Question Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Área de auditoría:
              </span>
              <div className="relative min-w-[220px]">
                <select
                  value={selectedStructureCategoryId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedStructureCategoryId(newId);
                    localStorage.setItem("audit-structure-last-cat", newId);
                  }}
                  className="w-full appearance-none h-11 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-4 pr-10 text-sm font-black text-slate-900 dark:text-white outline-none focus:border-blue-500 shadow-sm transition"
                >
                  {renderableCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.items.length} {c.items.length === 1 ? "pregunta" : "preguntas"})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={openNewItemDrawer}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-wider hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all"
              >
                <Plus className="h-4 w-4" /> Nueva pregunta
              </button>
            </div>
          </div>

          {/* Search, Filter Bar & Counters */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Buscar por # o texto..."
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition"
                />
              </div>

              {/* Sector filter */}
              {isOrdersCategory ? (
                <select
                  value={filterSector}
                  onChange={(e) => setFilterSector(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 transition"
                >
                  <option value="all">Sector: Todos</option>
                  {Object.entries(SECTOR_LABELS).map(([sec, label]) => (
                    <option key={sec} value={sec}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="h-10 px-3 flex items-center text-xs font-semibold text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-white/5">
                  Sector: No aplica
                </div>
              )}

              {/* Responsible Role filter */}
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="h-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 transition"
              >
                <option value="all">Responsable: Todos</option>
                {RESPONSIBLE_ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Status filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="h-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 transition"
              >
                <option value="all">Estado: Todos</option>
                <option value="active">Solo Activas</option>
                <option value="inactive">Solo Inactivas</option>
              </select>
            </div>

            {/* Filter Summary & Reset Action */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5 text-xs">
              <span className="font-bold text-slate-500 dark:text-slate-400">
                Mostrando{" "}
                <span className="font-black text-slate-900 dark:text-white">
                  {visibleItems.length}
                </span>{" "}
                de{" "}
                <span className="font-black text-slate-900 dark:text-white">
                  {categoryItems.length}
                </span>{" "}
                preguntas en el checklist
              </span>

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1.5 text-xs font-black text-blue-600 hover:text-blue-800 transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {/* Question List (Strict Order Maintained) */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 shadow-sm">
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {visibleItems.map((item) => {
                const originalIndex = categoryItems.findIndex((it) => it.id === item.id) + 1;
                const isFirst = originalIndex === 1;
                const isLast = originalIndex === categoryItems.length;

                return (
                  <div
                    key={item.id}
                    onClick={() => openEditDrawer(item)}
                    className={cn(
                      "group flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 transition cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5",
                      item.active === false ? "opacity-60 bg-slate-50/50" : ""
                    )}
                  >
                    {/* Left: Sequence Number & Text */}
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      {/* Number badge */}
                      <span className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-black text-slate-700 dark:text-slate-300 shrink-0">
                        {String(originalIndex).padStart(2, "0")}
                      </span>

                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug group-hover:text-blue-600 transition">
                            {item.text}
                          </p>
                        </div>

                        {item.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                            {item.description}
                          </p>
                        )}

                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {/* Active / Inactive */}
                          <span
                            className={cn(
                              "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md",
                              item.active === false
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                            )}
                          >
                            {item.active === false ? "Inactiva" : "Activa"}
                          </span>

                          {/* Sector */}
                          {item.sector && isOrdersCategory && (
                            <span className="rounded-md bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/40">
                              {SECTOR_LABELS[item.sector]}
                            </span>
                          )}

                          {/* Priority */}
                          {item.priority === "high" && (
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
                              Crítico
                            </span>
                          )}

                          {/* Weight */}
                          {item.weight && item.weight !== 1 && (
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                              Peso: {item.weight}
                            </span>
                          )}

                          {/* Responsible Roles Chips */}
                          <div className="flex flex-wrap items-center gap-1 ml-1">
                            <span className="text-[9px] font-bold text-slate-400 mr-0.5">
                              Resp:
                            </span>
                            {(item.responsibleRoles || []).map((role) => (
                              <span
                                key={role}
                                className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300"
                              >
                                {role}
                              </span>
                            ))}
                            {(!item.responsibleRoles || item.responsibleRoles.length === 0) && (
                              <span className="text-[9px] italic text-rose-500 font-bold">
                                Sin responsable
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div
                      className="flex items-center gap-1 self-end md:self-center shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => openEditDrawer(item)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition"
                      >
                        Editar
                      </button>

                      {/* Move Up */}
                      <button
                        type="button"
                        onClick={() => handleMoveItem(item.id, "up")}
                        disabled={isFirst}
                        title="Subir de posición"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-20 transition"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>

                      {/* Move Down */}
                      <button
                        type="button"
                        onClick={() => handleMoveItem(item.id, "down")}
                        disabled={isLast}
                        title="Bajar de posición"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-20 transition"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>

                      {/* Duplicate Item */}
                      <button
                        type="button"
                        onClick={() => {
                          if (handleDuplicateItem) {
                            handleDuplicateItem(activeCategory.id, item.id);
                          } else {
                            // Fallback duplicate in category
                            const currIdx = categoryItems.findIndex((it) => it.id === item.id);
                            const dupItem: AuditTemplateItem = {
                              ...item,
                              id: createClientId(),
                              text: `${item.text} - copia`,
                              order: currIdx + 2,
                            };
                            updateCategory(activeCategory.id, (cat) => {
                              const next = [...cat.items];
                              next.splice(currIdx + 1, 0, dupItem);
                              return {
                                ...cat,
                                items: next.map((it, i) => ({ ...it, order: i + 1 })),
                              };
                            });
                          }
                        }}
                        title="Duplicar pregunta"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition"
                      >
                        <Copy className="h-4 w-4" />
                      </button>

                      {/* Delete Item */}
                      <button
                        type="button"
                        onClick={() => setItemToDelete(item)}
                        title="Eliminar pregunta"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {visibleItems.length === 0 && (
                <div className="py-16 text-center space-y-2">
                  <Info className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    No se encontraron preguntas con los filtros seleccionados
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={resetFilters}
                      className="text-xs font-black text-blue-600 underline"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB: REGLAS DE CÁLCULO */}
      {activeTab === "matrix" && (
        <div className="space-y-4 animate-in zoom-in-95 duration-300">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-6 rounded-2xl shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <h4 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Matriz de Vínculos de Calidad
                </h4>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 max-w-2xl">
                  Cada tilde agrega la pregunta de origen al promedio automático de cumplimiento de la
                  pregunta destino. Los vínculos se sincronizan con la hoja <strong>Reglas de cálculo</strong> en Google Sheets.
                </p>
              </div>

              {/* Area Selectors */}
              <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-white/5 p-3 rounded-2xl border border-slate-200 dark:border-white/5">
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                    Área Origen
                  </span>
                  <select
                    value={selectedSourceAreaName}
                    onChange={(e) => setSelectedSourceAreaName(e.target.value)}
                    className="bg-transparent text-xs font-black text-slate-900 dark:text-white outline-none min-w-[140px]"
                  >
                    <option value="">Seleccionar área...</option>
                    {renderableCategories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-[1px] h-8 bg-slate-200 dark:bg-white/10 hidden sm:block" />

                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                    Área Destino
                  </span>
                  <select
                    value={selectedTargetAreaName}
                    onChange={(e) => setSelectedTargetAreaName(e.target.value)}
                    className="bg-transparent text-xs font-black text-slate-900 dark:text-white outline-none min-w-[140px]"
                  >
                    <option value="">Seleccionar área...</option>
                    {renderableCategories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto border border-slate-100 dark:border-white/5 rounded-2xl bg-slate-50/50 dark:bg-black/20">
              {sourceMatrixItems.length > 0 && targetMatrixItems.length > 0 ? (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                      <th className="p-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[280px] sticky left-0 bg-slate-100 dark:bg-slate-900 z-10">
                        Origen \ Destino
                      </th>
                      {targetMatrixItems.map((target, i) => (
                        <th
                          key={target.id}
                          className="p-4 text-center min-w-[180px] border-l border-slate-200 dark:border-white/5"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <span className="h-7 w-7 rounded-full bg-slate-900 dark:bg-blue-600 text-[10px] font-black text-white flex items-center justify-center shadow-sm">
                              {i + 1}
                            </span>
                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase leading-tight line-clamp-2">
                              {target.text}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                    {sourceMatrixItems.map((source, r) => (
                      <tr
                        key={source.id}
                        className="hover:bg-white dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="p-4 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-[4px_0_12px_rgba(0,0,0,0.02)]">
                          <div className="flex items-start gap-3">
                            <span className="text-xs font-black text-slate-300 dark:text-slate-700 mt-0.5">
                              {String(r + 1).padStart(2, "0")}
                            </span>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug">
                              {source.text}
                            </p>
                          </div>
                        </td>
                        {targetMatrixItems.map((target) => {
                          const isLinked =
                            calculationRules.some(
                              (rule) =>
                                rule.active &&
                                rule.scope === selectedStructureScope &&
                                rule.sourceArea === selectedSourceAreaName &&
                                rule.sourceItemId === source.id &&
                                rule.targetArea === selectedTargetAreaName &&
                                rule.targetItemId === target.id
                            ) ||
                            source.scoreLinks?.some(
                              (link) =>
                                link.area === selectedTargetAreaName &&
                                link.destinationItemId === target.id
                            );

                          return (
                            <td
                              key={target.id}
                              className="p-4 text-center border-l border-slate-100 dark:border-white/5"
                            >
                              <button
                                onClick={() =>
                                  handleToggleCalculationLink({
                                    sourceArea: selectedSourceAreaName,
                                    sourceItemId: source.id,
                                    targetArea: selectedTargetAreaName,
                                    targetItemId: target.id,
                                  })
                                }
                                title={
                                  isLinked
                                    ? "Quitar del promedio automático"
                                    : "Vincular a este promedio automático"
                                }
                                className={cn(
                                  "h-10 w-10 mx-auto rounded-xl border-2 transition-all flex items-center justify-center font-bold text-sm",
                                  isLinked
                                    ? "bg-emerald-500 border-emerald-400 text-white shadow-md shadow-emerald-500/20 scale-105"
                                    : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-300 hover:border-emerald-400 hover:text-emerald-500"
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
                <div className="py-20 text-center space-y-3">
                  <Link2 className="h-10 w-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Seleccioná un área de origen y un área de destino para visualizar los vínculos
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. QUESTION DRAWER / SIDE PANEL */}
      <AnimatePresence>
        {drawerOpen && drawerItem && (
          <div
            className="fixed inset-0 z-[120] flex justify-end bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Click outside backdrop to close */}
            <div className="absolute inset-0" onClick={closeDrawer} />

            {/* Slide-over Container */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-xl h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col z-10 border-l border-slate-200 dark:border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                      {isNewQuestion ? "Creación" : "Edición de Ítem"}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs font-bold text-slate-500">
                      Área: {activeCategory?.name}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {isNewQuestion ? "Nueva pregunta" : `Pregunta #${drawerItem.order || 1}`}
                  </h3>
                </div>

                <button
                  onClick={closeDrawer}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {/* Section 1: General */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    1. Información General
                  </h4>

                  {/* Question Text */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Texto de la pregunta <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={drawerItem.text}
                      onChange={(e) =>
                        setDrawerItem((prev) => (prev ? { ...prev, text: e.target.value } : null))
                      }
                      placeholder="Ej: Vale de Repuestos..."
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 p-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  {/* Description / Repregunta */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Descripción o aclaración
                    </label>
                    <textarea
                      rows={2}
                      value={drawerItem.description || ""}
                      onChange={(e) =>
                        setDrawerItem((prev) => (prev ? { ...prev, description: e.target.value } : null))
                      }
                      placeholder="Con firma y fechas correspondientes (técnico + repuestos)..."
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  {/* Acceptance Criteria / Guidance */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Criterio de aceptación / Guía de referencia
                    </label>
                    <textarea
                      rows={2}
                      value={drawerItem.guidance || ""}
                      onChange={(e) =>
                        setDrawerItem((prev) => (prev ? { ...prev, guidance: e.target.value } : null))
                      }
                      placeholder="Indicaciones para el auditor sobre qué verificar..."
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  {/* Active Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Pregunta activa
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Las preguntas inactivas no se muestran en auditorías nuevas.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDrawerItem((prev) =>
                          prev ? { ...prev, active: prev.active === false ? true : false } : null
                        )
                      }
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        drawerItem.active !== false ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          drawerItem.active !== false ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Section 2: Classification */}
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    2. Clasificación y Ponderación
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Area selector (allows moving item) */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Área de pertenencia
                      </label>
                      <select
                        value={targetCategoryId}
                        onChange={(e) => setTargetCategoryId(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                      >
                        {renderableCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Sector (if applicable) */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Sector
                      </label>
                      <select
                        value={drawerItem.sector || "recepcion"}
                        onChange={(e) =>
                          setDrawerItem((prev) =>
                            prev ? { ...prev, sector: e.target.value as OrAuditSector } : null
                          )
                        }
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                      >
                        {Object.entries(SECTOR_LABELS).map(([sec, label]) => (
                          <option key={sec} value={sec}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Priority */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Prioridad
                      </label>
                      <select
                        value={drawerItem.priority || "medium"}
                        onChange={(e) =>
                          setDrawerItem((prev) =>
                            prev ? { ...prev, priority: e.target.value as AuditItemPriority } : null
                          )
                        }
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                      >
                        <option value="low">Baja</option>
                        <option value="medium">Media (Estándar)</option>
                        <option value="high">Alta / Crítica</option>
                      </select>
                    </div>

                    {/* Weight */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Ponderación (Peso)
                      </label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.5"
                        value={drawerItem.weight ?? 1}
                        onChange={(e) =>
                          setDrawerItem((prev) =>
                            prev ? { ...prev, weight: parseFloat(e.target.value) || 1 } : null
                          )
                        }
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Responsible Roles (CRITICAL) */}
                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                      3. Responsables del Punto
                    </h4>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                      {drawerItem.responsibleRoles?.length || 0} asignados
                    </span>
                  </div>

                  {/* Informative Callout */}
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 text-xs text-blue-900 dark:text-blue-200">
                    <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed text-[11px]">
                      Las respuestas <strong>SÍ / NO</strong> de esta pregunta impactarán{" "}
                      <strong>únicamente</strong> en los roles seleccionados abajo. Si un rol no está
                      marcado, este ítem no afectará su puntaje en el reporte.
                    </p>
                  </div>

                  {/* Role Chip Selector */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {RESPONSIBLE_ROLE_OPTIONS.map((opt) => {
                      const isSelected = (drawerItem.responsibleRoles || []).includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setDrawerItem((prev) => {
                              if (!prev) return null;
                              const current = prev.responsibleRoles || [];
                              const next = isSelected
                                ? current.filter((r) => r !== opt.value)
                                : [...current, opt.value];
                              return { ...prev, responsibleRoles: next };
                            });
                          }}
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition",
                            isSelected
                              ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                              : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-blue-400"
                          )}
                        >
                          <span>{opt.label}</span>
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section 4: Behavior */}
                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-white/5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    4. Reglas de Evaluación
                  </h4>

                  <div className="space-y-2">
                    {/* Allows N/A */}
                    <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 cursor-pointer">
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Permite N/A (No Aplica)
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Si se responde N/A, el ítem se excluye del total aplicable.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={drawerItem.allowsNa !== false}
                        onChange={(e) =>
                          setDrawerItem((prev) =>
                            prev ? { ...prev, allowsNa: e.target.checked } : null
                          )
                        }
                        className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                    </label>

                    {/* Required Comment on Fail */}
                    <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 cursor-pointer">
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Observación obligatoria ante fallo
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Exige comentario o evidencia al marcar NO.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(drawerItem.requiresCommentOnFail)}
                        onChange={(e) =>
                          setDrawerItem((prev) =>
                            prev ? { ...prev, requiresCommentOnFail: e.target.checked } : null
                          )
                        }
                        className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 flex items-center justify-between">
                <div>
                  {isDrawerDirty && (
                    <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Cambios sin guardar
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeDrawer}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveDrawer}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-wider hover:bg-blue-700 shadow-md shadow-blue-500/20 transition"
                  >
                    Guardar pregunta
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. MODAL: NUEVA ÁREA */}
      <AnimatePresence>
        {isNewCategoryModalOpen && (
          <div
            className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Crear nueva área de control
                </h3>
                <button
                  onClick={() => setIsNewCategoryModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nombre del área <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Ej: Lavado y Entrega..."
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Descripción (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    placeholder="Breve propósito de esta auditoría..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Personal inicial (separado por coma)
                  </label>
                  <input
                    type="text"
                    value={newCatStaff}
                    onChange={(e) => setNewCatStaff(e.target.value)}
                    placeholder="Ej: Juan Pérez, Roberto Gómez"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewCategory}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-wider hover:bg-blue-700"
                >
                  Crear área
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* 8. MODAL: EDITAR ÁREA */}
      <AnimatePresence>
        {editingCategory && (
          <div
            className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Editar área: {editingCategory.name}
                </h3>
                <button
                  onClick={() => setEditingCategory(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nombre del área
                  </label>
                  <input
                    type="text"
                    value={editCatName}
                    onChange={(e) => setEditCatName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Descripción
                  </label>
                  <textarea
                    rows={2}
                    value={editCatDesc}
                    onChange={(e) => setEditCatDesc(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditedCategory}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-wider hover:bg-blue-700"
                >
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* 9. MODAL: CONFIRMAR ELIMINACIÓN DE ÁREA (PROTECCIÓN) */}
      <AnimatePresence>
        {categoryToDelete && (
          <div
            className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  ¿Eliminar el área "{categoryToDelete.name}"?
                </h3>
              </div>

              {categoryToDelete.items.length > 0 ? (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-bold">
                    ⚠️ Esta categoría contiene {categoryToDelete.items.length} preguntas asociadas.
                  </p>
                  <p>
                    Eliminarla borrará permanentemente sus preguntas y reglas de cálculo. Te
                    recomendamos <strong>desactivarla</strong> en su lugar para preservar la integridad histórica.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Esta acción eliminará el área de control. No contiene preguntas asignadas.
                </p>
              )}

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCategoryToDelete(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  Cancelar
                </button>

                {categoryToDelete.items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      updateCategory(categoryToDelete.id, (cat) => ({ ...cat, active: false }));
                      setCategoryToDelete(null);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-black uppercase tracking-wider hover:bg-amber-600"
                  >
                    Desactivar área
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    handleDeleteCategory(categoryToDelete.id);
                    setCategoryToDelete(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-black uppercase tracking-wider hover:bg-rose-700"
                >
                  Eliminar definitivamente
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* 10. MODAL: CONFIRMAR ELIMINACIÓN DE PREGUNTA */}
      <AnimatePresence>
        {itemToDelete && activeCategory && (
          <div
            className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40">
                  <Trash2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    ¿Eliminar esta pregunta?
                  </h3>
                  <p className="text-xs text-slate-500">
                    Se quitará del checklist de {activeCategory.name}.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {itemToDelete.text}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteItem(activeCategory.id, itemToDelete.id);
                    setItemToDelete(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-black uppercase tracking-wider hover:bg-rose-700"
                >
                  Eliminar pregunta
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Micro-component: Inline staff tag input
 */
function InlineAddStaff({
  placeholder = "+ Colaborador",
  onAdd,
}: {
  placeholder?: string;
  onAdd: (name: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue("");
    }
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-md border border-dashed border-slate-300 dark:border-white/20 px-2 py-0.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition"
      >
        {placeholder}
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      <input
        type="text"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") setIsOpen(false);
        }}
        placeholder="Nombre..."
        className="h-6 w-28 rounded-md border border-blue-400 bg-white dark:bg-slate-800 px-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
      />
      <button
        type="button"
        onClick={handleSubmit}
        className="h-6 px-1.5 rounded-md bg-blue-600 text-white text-[10px] font-bold"
      >
        ✓
      </button>
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="h-6 px-1 rounded-md text-slate-400 hover:text-slate-600 text-xs"
      >
        ✕
      </button>
    </div>
  );
}
