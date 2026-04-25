import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, FolderKanban, Link2, ListChecks, PlusCircle, Settings2, Trash2 } from "lucide-react";
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
  availableScoreAreas,
  handleAddItem,
  handleMoveItem,
  lastStructureSavedAt,
}: StructurePanelProps) {
  const [mode, setMode] = useState<"create" | "edit">("edit");
  const [selectedScoreItemId, setSelectedScoreItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [showOnlyLinked, setShowOnlyLinked] = useState(false);
  const [selectedSourceAreaName, setSelectedSourceAreaName] = useState("");
  const [selectedTargetAreaName, setSelectedTargetAreaName] = useState("");
  const [selectedImpactTargetAreaName, setSelectedImpactTargetAreaName] = useState("");
  const [selectedImpactTargetItemId, setSelectedImpactTargetItemId] = useState("");
  const [selectedImpactWeight, setSelectedImpactWeight] = useState(100);
  const selectedCategoryQuestions = selectedStructureCategory?.items.length ?? 0;
  const scoreAreaOptions = availableScoreAreas.filter((area) => area !== selectedStructureCategory?.name);
  const scoreAreaEntries = scoreAreaOptions.map((areaName, index) => ({
    areaName,
    number: index + 1,
  }));
  const savedLabel = lastStructureSavedAt
    ? new Date(lastStructureSavedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : null;

  useEffect(() => {
    if (mode === "edit" && !selectedStructureCategory && auditCategories.length > 0) {
      setSelectedStructureCategoryId(auditCategories[0].id);
    }
  }, [auditCategories, mode, selectedStructureCategory, setSelectedStructureCategoryId]);

  useEffect(() => {
    if (!selectedStructureCategory) {
      setSelectedScoreItemId("");
      return;
    }

    if (
      !selectedScoreItemId
      || !selectedStructureCategory.items.some((item) => item.id === selectedScoreItemId)
    ) {
      setSelectedScoreItemId(selectedStructureCategory.items[0]?.id || "");
    }
  }, [selectedScoreItemId, selectedStructureCategory]);

  useEffect(() => {
    if (!selectedStructureCategory) {
      setSelectedTargetAreaName("");
      return;
    }

    setSelectedTargetAreaName(selectedStructureCategory.name);
  }, [selectedStructureCategory]);

  useEffect(() => {
    if (!selectedStructureCategory) {
      setSelectedImpactTargetAreaName("");
      return;
    }

    const nextArea = scoreAreaOptions[0] ?? selectedStructureCategory.name;
    setSelectedImpactTargetAreaName(nextArea);
  }, [scoreAreaOptions, selectedStructureCategory]);

  useEffect(() => {
    const nextItems = getItemsForArea(selectedImpactTargetAreaName);
    setSelectedImpactTargetItemId((current) => (
      nextItems.some((item) => item.id === current) ? current : nextItems[0]?.id ?? ""
    ));
  }, [selectedImpactTargetAreaName, auditCategories]);

  useEffect(() => {
    if (selectedSourceAreaName && scoreAreaOptions.includes(selectedSourceAreaName)) {
      return;
    }

    setSelectedSourceAreaName(scoreAreaOptions[0] ?? "");
  }, [scoreAreaOptions, selectedSourceAreaName]);

  const getItemsForArea = (areaName: string) => auditCategories.find((category) => category.name === areaName)?.items ?? [];

  const selectedSourceCategory = auditCategories.find((category) => category.name === selectedSourceAreaName) ?? null;
  const selectedTargetCategory = auditCategories.find((category) => category.name === selectedTargetAreaName) ?? selectedStructureCategory ?? null;
  const selectedImpactTargetItems = getItemsForArea(selectedImpactTargetAreaName);
  const selectedImpactTargetItem = selectedImpactTargetItems.find((item) => item.id === selectedImpactTargetItemId) ?? selectedImpactTargetItems[0] ?? null;
  const sourceMatrixItems = selectedSourceCategory?.items ?? [];
  const targetMatrixItems = selectedTargetCategory?.items ?? [];
  const selectedStructureItems = selectedStructureCategory?.items ?? [];
  const visibleStructureItems = selectedStructureItems.filter((item) => {
    const normalizedSearch = itemSearch.trim().toLowerCase();
    const matchesSearch = !normalizedSearch
      || item.text.toLowerCase().includes(normalizedSearch)
      || (item.block ?? "").toLowerCase().includes(normalizedSearch)
      || (item.guidance ?? "").toLowerCase().includes(normalizedSearch);
    const matchesActive = !showOnlyActive || item.active !== false;
    const matchesLinked = !showOnlyLinked || (Array.isArray(item.scoreLinks) && item.scoreLinks.length > 0);
    return matchesSearch && matchesActive && matchesLinked;
  });
  useEffect(() => {
    if (!selectedStructureCategory) {
      return;
    }

    if (visibleStructureItems.some((item) => item.id === selectedScoreItemId)) {
      return;
    }

    setSelectedScoreItemId(visibleStructureItems[0]?.id || selectedStructureItems[0]?.id || "");
  }, [selectedScoreItemId, selectedStructureCategory, selectedStructureItems, visibleStructureItems]);

  const toggleMatrixCell = (sourceItemId: string, destinationItemId: string) => {
    if (!selectedSourceCategory || !selectedTargetCategory) {
      return;
    }

    const sourceItem = selectedSourceCategory.items.find((item) => item.id === sourceItemId);
    const destinationItem = selectedTargetCategory.items.find((item) => item.id === destinationItemId);
    if (!sourceItem || !destinationItem) {
      return;
    }

    updateCategory(selectedSourceCategory.id, (category) => ({
      ...category,
      items: category.items.map((item) => {
        if (item.id !== sourceItemId) {
          return item;
        }

        const currentLinks = Array.isArray(item.scoreLinks) ? item.scoreLinks : [];
        const hasLink = currentLinks.some((link) => link.area === selectedTargetCategory.name && link.destinationItemId === destinationItemId);
        const nextLinks = hasLink
          ? currentLinks.filter((link) => !(link.area === selectedTargetCategory.name && link.destinationItemId === destinationItemId))
          : [
              ...currentLinks,
              {
                area: selectedTargetCategory.name,
                weight: 100,
                destinationItemId,
                destinationItemText: destinationItem.text,
              },
            ];

        return {
          ...item,
          scoreLinks: nextLinks,
          scoreAreas: nextLinks.map((link) => link.area),
        };
      }),
    }));
  };


  const selectedScoreItem = selectedStructureCategory?.items.find((item) => item.id === selectedScoreItemId) ?? null;
  const selectedItemLinks = Array.isArray(selectedScoreItem?.scoreLinks) ? selectedScoreItem.scoreLinks : [];

  const updateScoreLinksForItem = (
    itemId: string,
    nextScoreLinks: Array<{ area: string; weight: number; destinationItemId?: string; destinationItemText?: string }>,
  ) => {
    if (!selectedStructureCategory) {
      return;
    }

    updateCategory(selectedStructureCategory.id, (category) => ({
      ...category,
      items: category.items.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const normalizedLinks = nextScoreLinks
          .map((link) => ({
            area: link.area.trim(),
            weight: Math.round(link.weight),
            destinationItemId: link.destinationItemId?.trim() || "",
            destinationItemText: link.destinationItemText?.trim() || "",
          }))
          .filter((link) => link.area && link.weight > 0);

        return {
          ...item,
          scoreLinks: normalizedLinks,
          scoreAreas: normalizedLinks.map((link) => link.area),
        };
      }),
    }));
  };

  const addScoreLinkToSelectedItem = () => {
    if (!selectedScoreItem) {
      return;
    }

    if (!selectedImpactTargetAreaName || !selectedImpactTargetItem) {
      return;
    }

    const currentLinks = Array.isArray(selectedScoreItem.scoreLinks) ? selectedScoreItem.scoreLinks : [];
    const normalizedWeight = Math.min(100, Math.max(1, Math.round(selectedImpactWeight)));
    const existingIndex = currentLinks.findIndex((link) => link.area === selectedImpactTargetAreaName && link.destinationItemId === selectedImpactTargetItem.id);
    const nextLink = {
      area: selectedImpactTargetAreaName,
      weight: normalizedWeight,
      destinationItemId: selectedImpactTargetItem.id,
      destinationItemText: selectedImpactTargetItem.text,
    };

    updateScoreLinksForItem(
      selectedScoreItem.id,
      existingIndex >= 0
        ? currentLinks.map((link, index) => (index === existingIndex ? nextLink : link))
        : [...currentLinks, nextLink],
    );
  };

  return (
    <div className="space-y-6 rounded-[30px] border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur lg:p-6">
      <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Configuracion</p>
            <h3 className="mt-2 text-2xl font-black text-slate-900">Estructura de auditoria</h3>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-500">
              Primero elegi que queres hacer. Despues selecciona el perfil y trabaja solo sobre esa estructura.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:w-auto">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Modo activo</p>
              <p className="mt-1 text-sm font-black text-slate-900">
                {mode === "create" ? "Crear categoria" : "Modificar categoria"}
              </p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">Perfil activo</p>
              <p className="mt-1 text-sm font-black text-slate-900">
                {selectedStructureScope === "global" ? "General" : selectedStructureScope}
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Paso 1</p>
          <h4 className="mt-1 text-base font-black text-slate-900">Que queres hacer</h4>
        </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={cn(
            "group rounded-3xl border px-4 py-4 text-left transition-all",
            mode === "create"
              ? "border-emerald-500 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_18px_32px_rgba(16,185,129,0.24)]"
              : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/60"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={cn("text-[10px] font-black uppercase tracking-[0.16em]", mode === "create" ? "text-emerald-100" : "text-emerald-600")}>Modo</p>
              <p className="mt-1 text-base font-black">Crear categoria nueva</p>
              <p className={cn("mt-2 text-xs font-bold", mode === "create" ? "text-emerald-50/90" : "text-slate-500")}>
                Carga una categoria completa desde cero.
              </p>
            </div>
            <PlusCircle className={cn("h-5 w-5 shrink-0", mode === "create" ? "text-white" : "text-emerald-500")} />
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMode("edit")}
          className={cn(
            "group rounded-3xl border px-4 py-4 text-left transition-all",
            mode === "edit"
              ? "border-slate-900 bg-gradient-to-br from-slate-950 to-slate-800 text-white shadow-[0_18px_32px_rgba(15,23,42,0.22)]"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={cn("text-[10px] font-black uppercase tracking-[0.16em]", mode === "edit" ? "text-slate-300" : "text-slate-500")}>Modo</p>
              <p className="mt-1 text-base font-black">Modificar categoria</p>
              <p className={cn("mt-2 text-xs font-bold", mode === "edit" ? "text-slate-200" : "text-slate-500")}>
                Edita nombre, personal y preguntas existentes.
              </p>
            </div>
            <Settings2 className={cn("h-5 w-5 shrink-0", mode === "edit" ? "text-white" : "text-slate-500")} />
          </div>
        </button>
      </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Paso 2</p>
          <h4 className="mt-1 text-base font-black text-slate-900">Perfil de trabajo</h4>
        </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {([
          { id: "global", label: "General" },
          { id: "Salta", label: "Salta" },
          { id: "Jujuy", label: "Jujuy" },
        ] as Array<{ id: AuditStructureScope; label: string }>).map((scopeOption) => (
          <button
            key={scopeOption.id}
            onClick={() => setSelectedStructureScope(scopeOption.id)}
            className={cn(
              "rounded-3xl border px-4 py-4 text-left transition-all",
              selectedStructureScope === scopeOption.id
                ? "border-blue-500 bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-[0_18px_30px_rgba(37,99,235,0.24)]"
                : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/70"
            )}
          >
            <p className={cn("text-[10px] font-black uppercase tracking-[0.16em]", selectedStructureScope === scopeOption.id ? "text-blue-100" : "text-slate-500")}>Perfil</p>
            <p className="mt-1 text-base font-black">{scopeOption.label}</p>
            <p className={cn("mt-2 text-xs font-bold", selectedStructureScope === scopeOption.id ? "text-blue-50/90" : "text-slate-500")}>
              {scopeOption.id === "global" ? "Base comun para todas las sucursales." : `Estructura especifica de ${scopeOption.label}.`}
            </p>
          </button>
        ))}
      </div>
      </section>

      {mode === "create" && (
        <section className="space-y-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Paso 3</p>
            <h4 className="mt-1 text-base font-black text-slate-900">Nueva categoria</h4>
          </div>

        <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-5 shadow-[0_18px_36px_rgba(16,185,129,0.08)] space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-white/80 p-3">
            <div className="rounded-2xl bg-emerald-100 p-2 text-emerald-700">
              <FolderKanban className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">Completa los datos basicos de la categoria</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Nombre, descripcion interna y personal asociado.
              </p>
            </div>
          </div>

          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Nombre"
            className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-emerald-300"
          />
          <textarea
            value={newCategoryDescription}
            onChange={(e) => setNewCategoryDescription(e.target.value)}
            placeholder="Descripcion"
            className="min-h-[88px] w-full resize-none rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-emerald-300"
          />
          <textarea
            value={newCategoryStaff}
            onChange={(e) => setNewCategoryStaff(e.target.value)}
            placeholder="Personal (separado por coma)"
            className="min-h-[88px] w-full resize-none rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-emerald-300"
          />
          <button onClick={handleAddCategory} className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_18px_30px_rgba(16,185,129,0.22)]">
            Crear categoria
          </button>
        </div>
        </section>
      )}

      {mode === "edit" && (
      <section className="space-y-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Paso 3</p>
          <h4 className="mt-1 text-base font-black text-slate-900">Categorias y preguntas</h4>
        </div>

      <div className="space-y-5">
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-[0_16px_32px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Categorias del perfil</p>
              <p className="mt-1 text-sm font-black text-slate-900">{auditCategories.length} categorias disponibles</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="rounded-2xl bg-slate-900 px-3 py-2 text-right text-white">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">Perfil</p>
                <p className="mt-1 text-xs font-black">{selectedStructureScope === "global" ? "General" : selectedStructureScope}</p>
              </div>
              {savedLabel && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">Guardado</p>
                  <p className="mt-1 text-xs font-black text-emerald-900">{savedLabel}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1">
          {auditCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedStructureCategoryId(category.id)}
              className={cn(
                "min-w-[240px] shrink-0 rounded-2xl border px-4 py-3 text-left transition-all lg:min-w-[280px]",
                selectedStructureCategoryId === category.id
                  ? "border-slate-900 bg-gradient-to-br from-slate-950 to-slate-800 text-white shadow-[0_18px_30px_rgba(15,23,42,0.18)]"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black">{category.name}</p>
                  <p className={cn("mt-1 text-[11px] font-bold", selectedStructureCategoryId === category.id ? "text-slate-300" : "text-slate-500")}>
                    {category.description || "Sin descripcion cargada"}
                  </p>
                </div>
                <FolderKanban className={cn("mt-0.5 h-4 w-4 shrink-0", selectedStructureCategoryId === category.id ? "text-slate-200" : "text-slate-400")} />
              </div>
              <p className={cn("mt-3 text-[11px] font-black uppercase tracking-[0.14em]", selectedStructureCategoryId === category.id ? "text-slate-300" : "text-blue-600")}>
                {category.items.length} preguntas
              </p>
            </button>
          ))}
          </div>

          {auditCategories.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center">
              <p className="text-sm font-black text-slate-700">No hay categorias en este perfil.</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Cambia al modo crear para cargar la primera.</p>
            </div>
          )}
        </div>

        {selectedStructureCategory && (
          <div className="space-y-4">
            <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-5 shadow-[0_18px_36px_rgba(37,99,235,0.07)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">Categoria seleccionada</p>
                  <h5 className="mt-2 text-xl font-black text-slate-900">{selectedStructureCategory.name}</h5>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Edita los datos generales y luego revisa las preguntas de esta categoria.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:w-auto">
                  <div className="rounded-2xl border border-white bg-white/90 px-4 py-3 text-center shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Preguntas</p>
                    <p className="mt-1 text-base font-black text-slate-900">{selectedCategoryQuestions}</p>
                  </div>
                  <div className="rounded-2xl border border-white bg-white/90 px-4 py-3 text-center shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Personal</p>
                    <p className="mt-1 text-base font-black text-slate-900">{selectedStructureCategory.staffOptions.length}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 lg:hidden">
              <p className="font-black text-slate-900">Configuracion de puntaje</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Esta parte se configura mejor en computadora. En celular queda simplificada.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Datos de la categoria</p>
                  <h4 className="mt-1 text-base font-black text-slate-900">Nombre, descripcion y personal</h4>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    onClick={() => handleDuplicateCategory(selectedStructureCategory.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <FolderKanban className="h-3.5 w-3.5" />
                    Duplicar
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(selectedStructureCategory.id)}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={selectedStructureCategory.name}
                onChange={(e) => updateCategory(selectedStructureCategory.id, (category) => ({ ...category, name: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-300"
              />
              <textarea
                value={selectedStructureCategory.description}
                onChange={(e) => updateCategory(selectedStructureCategory.id, (category) => ({ ...category, description: e.target.value }))}
                placeholder="Descripcion interna de la categoria"
                className="min-h-[88px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-300"
              />
              <textarea
                value={selectedStructureCategory.staffOptions.join(", ")}
                onChange={(e) => updateCategory(selectedStructureCategory.id, (category) => ({
                  ...category,
                  staffOptions: e.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                }))}
                placeholder="Personal de la categoria"
                className="min-h-[88px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-300"
              />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
              <div className="flex items-start gap-3 rounded-3xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                  <ListChecks className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">Preguntas</p>
                  <p className="mt-1 text-sm font-black text-slate-900">Trabajá una pregunta por vez</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Agregá, elegí, reordená y vinculá desde bloques separados para que no se mezcle todo.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Paso 1</p>
                  <p className="mt-1 text-sm font-black text-slate-900">Agregar pregunta</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Escribí solo la nueva pregunta y presioná Agregar.</p>
                  <input
                    type="text"
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    placeholder="Escribí una nueva pregunta"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-300"
                  />
                </div>
                <div className="flex items-end">
                  <button onClick={handleAddItem} className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_18px_30px_rgba(37,99,235,0.2)]">
                    Agregar
                  </button>
                </div>
              </div>

              <div className="hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_36px_rgba(15,23,42,0.05)] lg:block">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-slate-500" />
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Vista avanzada</p>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Fila = pregunta origen. Columna = pregunta destino. Tocá la celda para vincularlas.
                  </p>
                </div>

                <div className="grid gap-4 p-4 xl:grid-cols-[260px_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Área origen</p>
                      <select
                        value={selectedSourceAreaName}
                        onChange={(event) => setSelectedSourceAreaName(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-300"
                      >
                        {auditCategories.map((category) => (
                          <option key={category.id} value={category.name}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Área destino</p>
                      <select
                        value={selectedTargetAreaName}
                        onChange={(event) => setSelectedTargetAreaName(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-300"
                      >
                        {auditCategories.map((category) => (
                          <option key={category.id} value={category.name}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
                      <p className="text-sm font-black text-slate-900">Cómo se usa</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Elegí una fila de origen y una columna destino. La celda verde queda vinculada.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                    {sourceMatrixItems.length > 0 && targetMatrixItems.length > 0 ? (
                      <div className="overflow-auto">
                        <table className="min-w-[900px] w-full table-fixed border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                              <th className="w-[34%] px-4 py-3">Origen</th>
                              {targetMatrixItems.map((destinationItem, index) => (
                                <th key={destinationItem.id} className="w-[92px] px-1 py-3 text-center">
                                  <div className="inline-flex flex-col items-center gap-1">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-black text-white">
                                      {index + 1}
                                    </span>
                                    <span className="max-w-[82px] text-[8px] leading-tight font-black text-slate-500">
                                      {destinationItem.text}
                                    </span>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sourceMatrixItems.map((sourceItem, rowIndex) => (
                              <tr key={sourceItem.id} className="border-b border-slate-100 last:border-b-0 align-top">
                                <td className="w-[34%] px-4 py-3">
                                  <div className="flex items-start gap-3">
                                    <span className="mt-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                                      #{String(rowIndex + 1).padStart(2, "0")}
                                    </span>
                                    <p className="text-sm font-semibold leading-5 text-slate-800">{sourceItem.text}</p>
                                  </div>
                                </td>
                                {targetMatrixItems.map((destinationItem) => {
                                  const isLinked = Array.isArray(sourceItem.scoreLinks)
                                    && sourceItem.scoreLinks.some((link) => link.area === selectedTargetCategory?.name && link.destinationItemId === destinationItem.id);

                                  return (
                                    <td key={`${sourceItem.id}-${destinationItem.id}`} className="w-[92px] px-1 py-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => toggleMatrixCell(sourceItem.id, destinationItem.id)}
                                        className={cn(
                                          "mx-auto flex h-10 w-10 items-center justify-center rounded-2xl border text-[11px] font-black transition",
                                          isLinked
                                            ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                                            : "border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-600"
                                        )}
                                        aria-label={`${sourceItem.text} -> ${destinationItem.text}`}
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
                      </div>
                    ) : (
                      <div className="p-8 text-center text-sm font-bold text-slate-500">
                        Elegí dos áreas para ver la matriz.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-slate-500" />
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Paso 2</p>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Seleccioná una pregunta, editála y vinculala desde acá. Este es el flujo principal para definir impactos entre áreas.
                  </p>
                </div>

                <div className="grid gap-0 xl:grid-cols-[340px_minmax(0,1fr)]">
                  <div className="max-h-[760px] overflow-y-auto border-b border-slate-200 bg-slate-50/70 p-3 xl:border-b-0 xl:border-r">
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <Link2 className="h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            value={itemSearch}
                            onChange={(event) => setItemSearch(event.target.value)}
                            placeholder="Buscar pregunta, bloque o guía"
                            className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setShowOnlyActive((current) => !current)}
                            className={cn(
                              "rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition",
                              showOnlyActive ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                            )}
                          >
                            Activas
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowOnlyLinked((current) => !current)}
                            className={cn(
                              "rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition",
                              showOnlyLinked ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700"
                            )}
                          >
                            Con vínculos
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-500 shadow-sm">
                        <span>{visibleStructureItems.length} visibles</span>
                        <span>{selectedStructureItems.length} totales</span>
                      </div>

                      <div className="space-y-2">
                        {visibleStructureItems.map((structureItem, index) => {
                          const isActive = structureItem.id === selectedScoreItemId;
                          const linkCount = Array.isArray(structureItem.scoreLinks) ? structureItem.scoreLinks.length : 0;
                          return (
                            <button
                              key={structureItem.id}
                              type="button"
                              onClick={() => setSelectedScoreItemId(structureItem.id)}
                              className={cn(
                                "w-full rounded-2xl border px-4 py-3 text-left transition-all",
                                isActive
                                  ? "border-slate-900 bg-slate-950 text-white shadow-[0_14px_24px_rgba(15,23,42,0.16)]"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className={cn("text-[10px] font-black uppercase tracking-[0.14em]", isActive ? "text-slate-300" : "text-slate-500")}>
                                    #{String(index + 1).padStart(2, "0")}
                                  </p>
                                  <p className="mt-1 line-clamp-3 text-sm font-black leading-5">
                                    {structureItem.text}
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]", structureItem.active === false ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
                                      {structureItem.active === false ? "Inactiva" : "Activa"}
                                    </span>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                                      {structureItem.block || "General"}
                                    </span>
                                  </div>
                                </div>
                                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]", isActive ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600")}>
                                  {linkCount}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {visibleStructureItems.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm font-bold text-slate-500">
                          No hay preguntas que coincidan con el filtro.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    {selectedScoreItem ? (
                      <>
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Pregunta activa</p>
                              <h5 className="mt-1 text-lg font-black text-slate-900">{selectedScoreItem.text}</h5>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]", selectedScoreItem.active === false ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
                                  {selectedScoreItem.active === false ? "Inactiva" : "Activa"}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                                  {selectedScoreItem.block || "General"}
                                </span>
                                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">
                                  {selectedItemLinks.length} vínculos
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleMoveItem(selectedScoreItem.id, "up")}
                                disabled={selectedStructureCategory.items[0]?.id === selectedScoreItem.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                                Subir
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveItem(selectedScoreItem.id, "down")}
                                disabled={selectedStructureCategory.items[selectedStructureCategory.items.length - 1]?.id === selectedScoreItem.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                  Bajar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicateItem(selectedStructureCategory.id, selectedScoreItem.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-300"
                              >
                                <FolderKanban className="h-3.5 w-3.5" />
                                Duplicar
                              </button>
                              <button
                                type="button"
                                onClick={() => updateCategory(selectedStructureCategory.id, (category) => ({
                                  ...category,
                                  items: category.items.map((item) => (
                                    item.id === selectedScoreItem.id ? { ...item, active: item.active === false } : item
                                  )),
                                }))}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700"
                              >
                                {selectedScoreItem.active === false ? "Activar" : "Desactivar"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(selectedStructureCategory.id, selectedScoreItem.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Quitar
                              </button>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <input
                              type="text"
                              value={selectedScoreItem.block ?? ""}
                              onChange={(event) => updateCategory(selectedStructureCategory.id, (category) => ({
                                ...category,
                                items: category.items.map((item) => (
                                  item.id === selectedScoreItem.id ? { ...item, block: event.target.value } : item
                                )),
                              }))}
                              placeholder="Bloque"
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-300"
                            />
                            <select
                              value={selectedScoreItem.priority ?? "medium"}
                              onChange={(event) => updateCategory(selectedStructureCategory.id, (category) => ({
                                ...category,
                                items: category.items.map((item) => (
                                  item.id === selectedScoreItem.id ? { ...item, priority: event.target.value as AuditItemPriority } : item
                                )),
                              }))}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-300"
                            >
                              <option value="high">Prioridad alta</option>
                              <option value="medium">Prioridad media</option>
                              <option value="low">Prioridad baja</option>
                            </select>
                          </div>
                          <label className="mt-3 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={selectedScoreItem.required}
                              onChange={(event) => updateCategory(selectedStructureCategory.id, (category) => ({
                                ...category,
                                items: category.items.map((item) => (
                                  item.id === selectedScoreItem.id ? { ...item, required: event.target.checked } : item
                                )),
                              }))}
                            />
                            Obligatoria
                          </label>
                          <textarea
                            value={selectedScoreItem.text}
                            onChange={(e) => updateCategory(selectedStructureCategory.id, (category) => ({
                              ...category,
                              items: category.items.map((item) => item.id === selectedScoreItem.id ? { ...item, text: e.target.value } : item),
                            }))}
                            className="mt-3 min-h-[110px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-800 outline-none transition focus:border-blue-300"
                          />
                        </div>

                        <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">Impactos del ítem</p>
                              <h6 className="mt-1 text-base font-black text-slate-900">{selectedScoreItem.text}</h6>
                              <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                                Este es el ítem origen. Desde acá definís a qué ítem destino impacta y con qué peso.
                                Si un ítem destino tiene vínculos, su resultado final se toma desde esos vínculos.
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white px-3 py-2 text-right shadow-sm">
                              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Vínculos</p>
                              <p className="mt-1 text-xl font-black text-slate-900">
                                {(selectedScoreItem.scoreLinks ?? []).length}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Área destino</p>
                              <select
                                value={selectedImpactTargetAreaName}
                                onChange={(event) => setSelectedImpactTargetAreaName(event.target.value)}
                                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-300"
                              >
                                {scoreAreaEntries.map((entry) => (
                                  <option key={`target-area-${entry.areaName}`} value={entry.areaName}>
                                    {entry.number}. {entry.areaName}
                                  </option>
                                ))}
                              </select>
                              <p className="mt-2 text-[11px] font-semibold text-slate-500">
                                Elegí el área que va a recibir el impacto.
                              </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Ítem destino</p>
                              <select
                                value={selectedImpactTargetItemId}
                                onChange={(event) => setSelectedImpactTargetItemId(event.target.value)}
                                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-300"
                              >
                                {selectedImpactTargetItems.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.text}
                                  </option>
                                ))}
                              </select>
                              <p className="mt-2 text-[11px] font-semibold text-slate-500">
                                Elegí la pregunta específica del área destino.
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Peso del vínculo</p>
                                  <p className="mt-1 text-sm font-black text-slate-900">{selectedImpactWeight}%</p>
                                </div>
                                <p className="text-[11px] font-semibold text-slate-500">100% = impacto completo</p>
                              </div>
                              <input
                                type="range"
                                min={1}
                                max={100}
                                value={selectedImpactWeight}
                                onChange={(event) => setSelectedImpactWeight(Number(event.target.value))}
                                className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-amber-500"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={addScoreLinkToSelectedItem}
                              className="rounded-2xl bg-gradient-to-r from-slate-950 to-slate-800 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_18px_30px_rgba(15,23,42,0.18)] transition hover:translate-y-[-1px]"
                            >
                              Guardar vínculo
                            </button>
                          </div>

                          <p className="mt-3 text-xs font-semibold text-slate-600">
                            El promedio se calcula por este vínculo puntual, no por el promedio completo del área.
                          </p>
                        </div>

                        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.04)]">
                          <div className="flex items-center gap-2">
                            <Link2 className="h-4 w-4 text-slate-500" />
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Vínculos activos</p>
                          </div>

                          {(selectedScoreItem.scoreLinks ?? []).length > 0 ? (
                            <div className="space-y-3">
                              {(selectedScoreItem.scoreLinks ?? []).map((link, linkIndex) => {
                                const entry = scoreAreaEntries.find((areaEntry) => areaEntry.areaName === link.area);
                                const destinationOptions = getItemsForArea(link.area);
                                const selectedDestinationItem = destinationOptions.find((item) => item.id === link.destinationItemId) ?? null;
                                return (
                                  <div key={`${selectedScoreItem.id}-${link.area}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                                          {entry?.number ?? "-"}
                                        </p>
                                        <p className="mt-1 text-sm font-black text-slate-900">{link.area}</p>
                                        <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                          {selectedDestinationItem?.text || "Elegí la pregunta puntual"}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                                          {link.weight}%
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => updateScoreLinksForItem(
                                            selectedScoreItem.id,
                                            (selectedScoreItem.scoreLinks ?? []).filter((current) => current.area !== link.area),
                                          )}
                                          className="rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-red-600"
                                        >
                                          Quitar
                                        </button>
                                      </div>
                                    </div>
                                    <input
                                      type="range"
                                      min={0}
                                      max={100}
                                      value={link.weight}
                                      onChange={(event) => {
                                        const nextWeight = Number(event.target.value);
                                        updateScoreLinksForItem(
                                          selectedScoreItem.id,
                                          (selectedScoreItem.scoreLinks ?? []).map((current) => (
                                            current.area === link.area ? { ...current, weight: nextWeight } : current
                                          )).filter((current) => current.weight > 0),
                                        );
                                      }}
                                      className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-amber-500"
                                    />
                                    <select
                                      value={link.destinationItemId || ""}
                                      onChange={(event) => {
                                        const destinationItemId = event.target.value;
                                        const destinationItemText = destinationOptions.find((item) => item.id === destinationItemId)?.text || "";
                                        updateScoreLinksForItem(
                                          selectedScoreItem.id,
                                          (selectedScoreItem.scoreLinks ?? []).map((current, currentIndex) => (
                                            currentIndex === linkIndex
                                              ? { ...current, destinationItemId, destinationItemText }
                                              : current
                                          )),
                                        );
                                      }}
                                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-300"
                                    >
                                      <option value="">Elegí una pregunta de {link.area}</option>
                                      {destinationOptions.map((item) => (
                                        <option key={item.id} value={item.id}>
                                          {item.text}
                                        </option>
                                      ))}
                                    </select>
                                    <p className="mt-2 text-[11px] font-semibold text-slate-500">
                                      Este vínculo apunta a un ítem puntual de {link.area}, no al promedio completo del área.
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm font-bold text-slate-500">
                              Aún no hay vínculos cargados.
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                        <p className="text-sm font-black text-slate-700">Elegí una pregunta para editar sus vínculos.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
      </section>
      )}
    </div>
  );
}




