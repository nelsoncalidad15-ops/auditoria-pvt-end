import { useEffect, useState } from "react";
import { FolderKanban, Link2, ListChecks, PlusCircle, Settings2, Trash2 } from "lucide-react";
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
  handleDeleteCategory: (categoryId: string) => void;
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
  newItemScoreAreas: string[];
  setNewItemScoreAreas: (updater: string[] | ((current: string[]) => string[])) => void;
  handleAddItem: () => void;
}

export function StructurePanel({
  selectedStructureScope,
  setSelectedStructureScope,
  auditCategories,
  selectedStructureCategory,
  selectedStructureCategoryId,
  setSelectedStructureCategoryId,
  updateCategory,
  handleDeleteCategory,
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
  newItemScoreAreas,
  setNewItemScoreAreas,
  handleAddItem,
}: StructurePanelProps) {
  const [mode, setMode] = useState<"create" | "edit">("edit");
  const selectedCategoryQuestions = selectedStructureCategory?.items.length ?? 0;

  useEffect(() => {
    if (mode === "edit" && !selectedStructureCategory && auditCategories.length > 0) {
      setSelectedStructureCategoryId(auditCategories[0].id);
    }
  }, [auditCategories, mode, selectedStructureCategory, setSelectedStructureCategoryId]);

  const scoreAreaOptions = availableScoreAreas.filter((area) => area !== selectedStructureCategory?.name);

  const toggleNewItemScoreArea = (areaName: string) => {
    setNewItemScoreAreas((current) => (
      current.includes(areaName)
        ? current.filter((value) => value !== areaName)
        : [...current, areaName]
    ));
  };

  const toggleStructureItemScoreArea = (itemId: string, areaName: string) => {
    if (!selectedStructureCategory) {
      return;
    }

    updateCategory(selectedStructureCategory.id, (category) => ({
      ...category,
      items: category.items.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const currentScoreAreas = Array.isArray(item.scoreAreas) ? item.scoreAreas : [];
        const nextScoreAreas = currentScoreAreas.includes(areaName)
          ? currentScoreAreas.filter((value) => value !== areaName)
          : [...currentScoreAreas, areaName];

        return {
          ...item,
          scoreAreas: nextScoreAreas,
        };
      }),
    }));
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-[0_16px_32px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Categorias del perfil</p>
              <p className="mt-1 text-sm font-black text-slate-900">{auditCategories.length} categorias disponibles</p>
            </div>
            <div className="rounded-2xl bg-slate-900 px-3 py-2 text-right text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">Perfil</p>
              <p className="mt-1 text-xs font-black">{selectedStructureScope === "global" ? "General" : selectedStructureScope}</p>
            </div>
          </div>

          <div className="space-y-2">
          {auditCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedStructureCategoryId(category.id)}
              className={cn(
                "w-full rounded-2xl border px-4 py-3 text-left transition-all",
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

            <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Datos de la categoria</p>
                  <h4 className="mt-1 text-base font-black text-slate-900">Nombre, descripcion y personal</h4>
                </div>
                <button
                  onClick={() => handleDeleteCategory(selectedStructureCategory.id)}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar
                </button>
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
              <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
                <div className="rounded-2xl bg-blue-100 p-2 text-blue-700">
                  <ListChecks className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">Preguntas de la categoria</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Agrega nuevas preguntas o ajusta las actuales una por una.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  placeholder="Escribi una nueva pregunta"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-300"
                />
                <button onClick={handleAddItem} className="rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_18px_30px_rgba(37,99,235,0.2)]">
                  Agregar
                </button>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-blue-600" />
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Puntaje compartido
                  </p>
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  El item sumara a la categoria actual y ademas a las areas que marques abajo.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {scoreAreaOptions.length > 0 ? scoreAreaOptions.map((areaName) => {
                    const isSelected = newItemScoreAreas.includes(areaName);
                    return (
                      <button
                        key={`new-item-score-${areaName}`}
                        type="button"
                        onClick={() => toggleNewItemScoreArea(areaName)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition",
                          isSelected
                            ? "border-blue-500 bg-blue-500 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-600"
                        )}
                      >
                        {areaName}
                      </button>
                    );
                  }) : (
                    <p className="text-xs font-semibold text-slate-500">No hay areas disponibles para vincular.</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {selectedStructureCategory.items.map((structureItem, index) => (
                  <div key={structureItem.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.03)]">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 shadow-sm">#{String(index + 1).padStart(2, "0")} Pregunta</span>
                      <button
                        onClick={() => updateCategory(selectedStructureCategory.id, (category) => ({
                          ...category,
                          items: category.items.filter((item) => item.id !== structureItem.id),
                        }))}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Quitar
                      </button>
                    </div>
                    <textarea
                      value={structureItem.text}
                      onChange={(e) => updateCategory(selectedStructureCategory.id, (category) => ({
                        ...category,
                        items: category.items.map((item) => item.id === structureItem.id ? { ...item, text: e.target.value } : item),
                      }))}
                      className="min-h-[88px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-300"
                    />
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-amber-500" />
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Puntaje compartido
                        </p>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Este item ya suma a su propia categoria. Elegi otras areas que tambien recibiran el promedio.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {scoreAreaOptions.length > 0 ? scoreAreaOptions.map((areaName) => {
                          const isSelected = Array.isArray(structureItem.scoreAreas) && structureItem.scoreAreas.includes(areaName);
                          return (
                            <button
                              key={`${structureItem.id}-score-${areaName}`}
                              type="button"
                              onClick={() => toggleStructureItemScoreArea(structureItem.id, areaName)}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition",
                                isSelected
                                  ? "border-amber-500 bg-amber-500 text-white shadow-sm"
                                  : "border-slate-200 bg-white text-slate-500 hover:border-amber-200 hover:text-amber-600"
                              )}
                            >
                              {areaName}
                            </button>
                          );
                        }) : (
                          <p className="text-xs font-semibold text-slate-500">No hay areas disponibles para vincular.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {selectedStructureCategory.items.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm font-bold text-slate-500">
                    Todavia no hay preguntas en esta categoria.
                  </div>
                )}
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
