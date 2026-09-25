import { useCallback, useEffect, useRef, useState } from "react";
import { createClientId } from "../lib/utils";
import { loadAuditCategoriesFromCloud, saveAuditCategoriesToCloud } from "../services/audit-structure-cloud";
import { fetchAuditStructureFromWebhook, saveAuditStructureToWebhook, saveCalculationRulesToWebhook } from "../services/audit-sync";
import { getStoredAuditCategories, normalizeAuditCategories, resetAuditCategories, saveAuditCategories } from "../services/audit-structure";
import {
  AuditCategory,
  CalculationRule,
  ProcessDefinition,
  AuditItemPriority,
  AuditStructureScope,
  Location,
  OrAuditSector,
  OrResponsibleRole,
  Role,
} from "../types";

interface UseAuditStructureParams {
  isAuthReady: boolean;
  isCloudStructureAvailable: boolean;
  hasAuthenticatedUser: boolean;
  userEmail?: string | null;
  selectedRole: Role | null;
  setSelectedRole: (role: Role | null) => void;
  setSelectedStaff: (staff: string) => void;
  sessionLocation?: Location;
  hasWebhookUrl: boolean;
  webhookUrl: string;
  onSaveSuccess?: (message: string) => void;
}

function getStoredScopeOrEmpty(scope: Exclude<AuditStructureScope, "global">) {
  if (typeof window === "undefined") {
    return [] as AuditCategory[];
  }

  return window.localStorage.getItem(`audit-structure-v1:${scope}`)
    ? getStoredAuditCategories(scope)
    : [];
}

const createInitialScopes = (): Record<AuditStructureScope, AuditCategory[]> => ({
  global: getStoredAuditCategories("global"),
  // Jujuy y Salta comparten la base global hasta que exista una excepción
  // explícita guardada para una sucursal.
  Salta: getStoredScopeOrEmpty("Salta"),
  Jujuy: getStoredScopeOrEmpty("Jujuy"),
  "Sin ubicación": getStoredScopeOrEmpty("Sin ubicación"),
});
const createInitialReportFilter = () => ({
  role: getStoredAuditCategories("global")[0]?.name || "Ordenes",
  staff: "",
  month: new Date().toISOString().slice(0, 7),
});

const CALCULATION_RULES_STORAGE_KEY = "audit-calculation-rules-v1";

type MatrixCalculationLinkInput = {
  sourceArea: string;
  sourceItemId: string;
  targetArea: string;
  targetItemId: string;
};

function normalizeRuleLabel(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es-AR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getStoredCalculationRules() {
  if (typeof window === "undefined") return [] as CalculationRule[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CALCULATION_RULES_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed as CalculationRule[] : [];
  } catch {
    return [] as CalculationRule[];
  }
}

function storeCalculationRules(rules: CalculationRule[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CALCULATION_RULES_STORAGE_KEY, JSON.stringify(rules));
  }
}

function isSameMatrixRule(
  rule: CalculationRule,
  link: { sourceArea?: string; sourceItemId?: string; targetArea: string; targetItemId: string },
  scope: AuditStructureScope,
) {
  return rule.scope === scope
    && rule.targetArea === link.targetArea
    && rule.targetItemId === link.targetItemId
    && rule.sourceArea === link.sourceArea
    && rule.sourceItemId === link.sourceItemId
    && (rule.sourceType === "question" || rule.sourceType === "or_question");
}

function buildMatrixCalculationRule({
  scope,
  sourceCategory,
  sourceItemId,
  targetArea,
  targetItemId,
}: {
  scope: AuditStructureScope;
  sourceCategory: AuditCategory;
  sourceItemId: string;
  targetArea: string;
  targetItemId: string;
}): CalculationRule | null {
  const sourceItem = sourceCategory.items.find((item) => item.id === sourceItemId);
  if (!sourceItem) return null;

  const isOrderSource = normalizeRuleLabel(sourceCategory.name).includes("orden");
  const sourceRoles = sourceItem.responsibleRoles ?? [];
  const sourceRole = isOrderSource && sourceRoles.length === 1 ? sourceRoles[0] : undefined;
  const idParts = [scope, sourceCategory.name, sourceItemId, targetArea, targetItemId].map(normalizeRuleLabel).filter(Boolean);

  return {
    id: `matriz-${idParts.join("-")}`,
    scope,
    active: true,
    targetArea,
    targetItemId,
    sourceType: isOrderSource ? "or_question" : "question",
    sourceArea: sourceCategory.name,
    sourceItemId,
    sourceRole,
    method: "promedio_por_colaborador",
    sourceWeight: 1,
    minimumCoverage: 100,
    detail: `Promedio de ${sourceCategory.name}: ${sourceItem.text}`,
  };
}

function mergeCalculationRules(primary: CalculationRule[], derived: CalculationRule[]) {
  return derived.reduce((rules, candidate) => {
    const exists = rules.some((rule) => isSameMatrixRule(rule, candidate, candidate.scope));
    return exists ? rules : [...rules, candidate];
  }, [...primary]);
}

function buildCalculationRulesFromLinks(scope: AuditStructureScope, categories: AuditCategory[]) {
  return categories.flatMap((sourceCategory) => sourceCategory.items.flatMap((sourceItem) => (
    (sourceItem.scoreLinks ?? []).flatMap((link) => {
      if (!link.destinationItemId || !link.area) return [];
      const rule = buildMatrixCalculationRule({
        scope,
        sourceCategory,
        sourceItemId: sourceItem.id,
        targetArea: link.area,
        targetItemId: link.destinationItemId,
      });
      return rule ? [rule] : [];
    })
  )));
}

function markCalculatedTargets(categories: AuditCategory[], rules: CalculationRule[], scope: AuditStructureScope) {
  const targetKeys = new Set(
    rules
      .filter((rule) => rule.active && rule.scope === scope)
      .map((rule) => `${rule.targetArea}::${rule.targetItemId}`),
  );

  return categories.map((category) => ({
    ...category,
    items: category.items.map((item) => targetKeys.has(`${category.name}::${item.id}`)
      ? { ...item, calculationMode: "calculated" as const }
      : item),
  }));
}
export function useAuditStructure({
  isAuthReady,
  isCloudStructureAvailable,
  hasAuthenticatedUser,
  userEmail,
  selectedRole,
  setSelectedRole,
  setSelectedStaff,
  sessionLocation,
  hasWebhookUrl,
  webhookUrl,
}: UseAuditStructureParams) {
  const [selectedStructureScope, setSelectedStructureScope] = useState<AuditStructureScope>("global");
  const [auditCategoryScopes, setAuditCategoryScopes] = useState<Record<AuditStructureScope, AuditCategory[]>>(createInitialScopes);
  const [calculationRules, setCalculationRules] = useState<CalculationRule[]>(getStoredCalculationRules);
  const [processDefinitions, setProcessDefinitions] = useState<ProcessDefinition[]>([]);
  const [selectedStructureCategoryId, setSelectedStructureCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [newCategoryStaff, setNewCategoryStaff] = useState("");
  const [newItemText, setNewItemText] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemBlock, setNewItemBlock] = useState("General");
  const [newItemSector, setNewItemSector] = useState<OrAuditSector>("recepcion");
  const [newItemResponsibleRoles, setNewItemResponsibleRoles] = useState<OrResponsibleRole[]>(["asesor"]);
  const [newItemPriority, setNewItemPriority] = useState<AuditItemPriority>("medium");
  const [newItemGuidance, setNewItemGuidance] = useState("");
  const [newItemRequired, setNewItemRequired] = useState(false);
  const [newItemAllowsNa, setNewItemAllowsNa] = useState(true);
  const [newItemWeight, setNewItemWeight] = useState(1);
  const [newItemActive, setNewItemActive] = useState(true);
  const [newItemRequiresCommentOnFail, setNewItemRequiresCommentOnFail] = useState(false);
  const [isLoadingStructureFromCloud, setIsLoadingStructureFromCloud] = useState(false);
  const [isSavingStructureToCloud, setIsSavingStructureToCloud] = useState(false);
  const [isLoadingStructureFromSheet, setIsLoadingStructureFromSheet] = useState(false);
  const [isSavingStructureToSheet, setIsSavingStructureToSheet] = useState(false);
  const [structureStorageLabel, setStructureStorageLabel] = useState<"local" | "cloud" | "sheet">("local");
  const [lastStructureSavedAt, setLastStructureSavedAt] = useState<string | null>(null);
  const [hasPendingStructureChanges, setHasPendingStructureChanges] = useState(false);
  const [reportFilter, setReportFilter] = useState(createInitialReportFilter);
  const loadedSheetUrlRef = useRef("");

  const getCategoriesForScope = (scope?: AuditStructureScope) => {
    const globalCategories = auditCategoryScopes.global;
    if (!scope || scope === "global") {
      return globalCategories;
    }

    const scopedCategories = auditCategoryScopes[scope];
    if (scopedCategories.length === 0) {
      return globalCategories;
    }

    const scopedKeys = new Set(scopedCategories.map((category) => `${category.id}:${category.name}`));
    return [
      ...globalCategories.filter((category) => !scopedKeys.has(`${category.id}:${category.name}`)),
      ...scopedCategories,
    ];
  };
  const auditCategories = getCategoriesForScope(selectedStructureScope);
  const activeAuditCategories = getCategoriesForScope(sessionLocation);
  const selectedAuditCategory = selectedRole
    ? activeAuditCategories.find((category) => category.name === selectedRole)
      ?? auditCategories.find((category) => category.name === selectedRole)
      ?? Object.values(auditCategoryScopes)
        .flatMap((categories) => categories)
        .find((category) => category.name === selectedRole)
      ?? null
    : null;
  const selectedStructureCategory = auditCategories.find((category) => category.id === selectedStructureCategoryId) ?? null;
  const reportCategoryItems = Array.from(new Map(
    Object.values(auditCategoryScopes)
      .flatMap((categories) => categories)
      .filter((category) => category.name === reportFilter.role)
      .map((category) => [category.id, category])
  ).values())[0]?.items ?? [];
  const allStaffOptions = Array.from(
    new Set(Object.values(auditCategoryScopes).flatMap((categories) => categories.flatMap((category) => category.staffOptions)))
  );
  const configuredCategoryCount = Array.from(
    new Set(Object.values(auditCategoryScopes).flatMap((categories) => categories.map((category) => category.name)))
  ).length;
  const allAuditAreaNames = Array.from(
    new Set(Object.values(auditCategoryScopes).flatMap((categories) => categories.map((category) => category.name)))
  ).sort((left, right) => left.localeCompare(right));

  const resetNewItemForm = useCallback(() => {
    setNewItemText("");
    setNewItemDescription("");
    setNewItemBlock("General");
    setNewItemSector("recepcion");
    setNewItemResponsibleRoles(["asesor"]);
    setNewItemPriority("medium");
    setNewItemGuidance("");
    setNewItemRequired(false);
    setNewItemAllowsNa(true);
    setNewItemWeight(1);
    setNewItemActive(true);
    setNewItemRequiresCommentOnFail(false);
  }, []);

  const persistAuditCategories = useCallback((nextCategories: AuditCategory[]) => {
    setAuditCategoryScopes((current) => ({
      ...current,
      [selectedStructureScope]: nextCategories,
    }));
    saveAuditCategories(nextCategories, selectedStructureScope);
    setStructureStorageLabel("local");
    setHasPendingStructureChanges(true);
    setLastStructureSavedAt(new Date().toISOString());
  }, [selectedStructureScope]);

  const updateCategory = useCallback((categoryId: string, updater: (category: AuditCategory) => AuditCategory) => {
    const currentCategory = auditCategories.find((category) => category.id === categoryId);
    if (!currentCategory) {
      return;
    }

    const nextCategory = updater(currentCategory);
    const nextCategories = auditCategories.map((category) => (
      category.id === categoryId ? nextCategory : category
    ));

    if (selectedRole === currentCategory.name && nextCategory.name !== currentCategory.name) {
      setSelectedRole(nextCategory.name);
    }

    if (reportFilter.role === currentCategory.name && nextCategory.name !== currentCategory.name) {
      setReportFilter((current) => ({ ...current, role: nextCategory.name }));
    }

    persistAuditCategories(nextCategories);
  }, [auditCategories, persistAuditCategories, reportFilter.role, selectedRole, setSelectedRole]);

  const handleToggleCalculationLink = useCallback((link: MatrixCalculationLinkInput) => {
    const sourceCategory = auditCategories.find((category) => category.name === link.sourceArea);
    const targetCategory = auditCategories.find((category) => category.name === link.targetArea);
    const sourceItem = sourceCategory?.items.find((item) => item.id === link.sourceItemId);
    const targetItem = targetCategory?.items.find((item) => item.id === link.targetItemId);
    if (!sourceCategory || !targetCategory || !sourceItem || !targetItem) return;

    const existingRule = calculationRules.find((rule) => isSameMatrixRule(rule, link, selectedStructureScope));
    const existingScoreLink = (sourceItem.scoreLinks ?? []).some((scoreLink) => (
      scoreLink.area === link.targetArea && scoreLink.destinationItemId === link.targetItemId
    ));
    const isRemoving = Boolean(existingRule || existingScoreLink);
    const createdRule = buildMatrixCalculationRule({
      scope: selectedStructureScope,
      sourceCategory,
      sourceItemId: sourceItem.id,
      targetArea: targetCategory.name,
      targetItemId: targetItem.id,
    });
    if (!createdRule) return;

    const nextRules = isRemoving
      ? calculationRules.filter((rule) => !isSameMatrixRule(rule, link, selectedStructureScope))
      : [...calculationRules, createdRule];
    const hasOtherLegacyTarget = auditCategories.some((category) => category.items.some((item) => (
      (item.scoreLinks ?? []).some((scoreLink) => (
        scoreLink.area === link.targetArea
        && scoreLink.destinationItemId === link.targetItemId
        && !(category.name === link.sourceArea && item.id === link.sourceItemId)
      ))
    )));
    const targetRemainsCalculated = !isRemoving || hasOtherLegacyTarget || nextRules.some((rule) => (
      rule.active
      && rule.scope === selectedStructureScope
      && rule.targetArea === link.targetArea
      && rule.targetItemId === link.targetItemId
    ));

    const nextCategories = auditCategories.map((category) => ({
      ...category,
      items: category.items.map((item) => {
        let nextItem = item;
        if (category.name === link.sourceArea && item.id === link.sourceItemId) {
          const currentLinks = item.scoreLinks ?? [];
          const nextLinks = isRemoving
            ? currentLinks.filter((scoreLink) => !(
                scoreLink.area === link.targetArea && scoreLink.destinationItemId === link.targetItemId
              ))
            : [...currentLinks, {
                area: link.targetArea,
                weight: 100,
                destinationItemId: link.targetItemId,
                destinationItemText: targetItem.text,
              }];
          nextItem = { ...nextItem, scoreLinks: nextLinks, scoreAreas: Array.from(new Set(nextLinks.map((scoreLink) => scoreLink.area))) };
        }
        if (category.name === link.targetArea && item.id === link.targetItemId) {
          nextItem = { ...nextItem, calculationMode: targetRemainsCalculated ? "calculated" : "manual" };
        }
        return nextItem;
      }),
    }));

    setCalculationRules(nextRules);
    storeCalculationRules(nextRules);
    persistAuditCategories(nextCategories);
  }, [auditCategories, calculationRules, persistAuditCategories, selectedStructureScope]);
  const handleDuplicateCategory = useCallback((categoryId: string) => {
    const categoryToDuplicate = auditCategories.find((category) => category.id === categoryId);
    if (!categoryToDuplicate) {
      return;
    }

    const baseName = `${categoryToDuplicate.name} - copia`;
    let nextName = baseName;
    let duplicateIndex = 2;
    while (auditCategories.some((category) => category.name.toLowerCase() === nextName.toLowerCase())) {
      nextName = `${baseName} ${duplicateIndex}`;
      duplicateIndex += 1;
    }

    const duplicatedCategory: AuditCategory = {
      ...categoryToDuplicate,
      id: createClientId(),
      name: nextName,
      items: categoryToDuplicate.items.map((item) => ({
        ...item,
        id: createClientId(),
        scoreLinks: [],
        scoreAreas: [],
      })),
    };

    const nextCategories = [...auditCategories, duplicatedCategory];
    persistAuditCategories(nextCategories);
    setSelectedStructureCategoryId(duplicatedCategory.id);
  }, [auditCategories, persistAuditCategories]);

  const handleAddCategory = useCallback(() => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      return;
    }

    if (auditCategories.some((category) => category.name.toLowerCase() === trimmedName.toLowerCase())) {
      alert("Ya existe una categoría con ese nombre.");
      return;
    }

    const newCategory: AuditCategory = {
      id: createClientId(),
      name: trimmedName,
      description: newCategoryDescription.trim(),
      staffOptions: newCategoryStaff.split(",").map((value) => value.trim()).filter(Boolean),
      items: [],
    };

    const nextCategories = [...auditCategories, newCategory];
    persistAuditCategories(nextCategories);
    setSelectedStructureCategoryId(newCategory.id);
    setNewCategoryName("");
    setNewCategoryDescription("");
    setNewCategoryStaff("");
  }, [auditCategories, newCategoryDescription, newCategoryName, newCategoryStaff, persistAuditCategories]);

  const handleDeleteCategory = useCallback((categoryId: string) => {
    if (auditCategories.length === 1) {
      alert("Necesitás al menos una categoría activa.");
      return;
    }

    const categoryToDelete = auditCategories.find((category) => category.id === categoryId);
    if (!categoryToDelete) {
      return;
    }

    const nextCategories = auditCategories.filter((category) => category.id !== categoryId);
    const nextRules = calculationRules.filter((rule) => !(
      rule.scope === selectedStructureScope
      && (rule.sourceArea === categoryToDelete.name || rule.targetArea === categoryToDelete.name)
    ));
    setCalculationRules(nextRules);
    storeCalculationRules(nextRules);
    persistAuditCategories(nextCategories);

    if (selectedStructureCategoryId === categoryId) {
      setSelectedStructureCategoryId(nextCategories[0]?.id || "");
    }

    if (selectedRole === categoryToDelete.name) {
      setSelectedRole(null);
      setSelectedStaff("");
    }

    if (reportFilter.role === categoryToDelete.name) {
      setReportFilter((current) => ({ ...current, role: nextCategories[0]?.name || current.role }));
    }
  }, [auditCategories, calculationRules, persistAuditCategories, reportFilter.role, selectedRole, selectedStructureCategoryId, selectedStructureScope, setSelectedRole, setSelectedStaff]);

  const handleAddItem = useCallback(() => {
    if (!selectedStructureCategory) {
      return;
    }

    const trimmedText = newItemText.trim();
    if (!trimmedText) {
      return;
    }

    updateCategory(selectedStructureCategory.id, (category) => ({
      ...category,
      items: [
        ...category.items,
        {
          id: createClientId(),
          text: trimmedText,
          required: newItemRequired,
          block: newItemBlock.trim() || "General",
          description: newItemDescription.trim(),
          sector: newItemSector,
          responsibleRoles: newItemResponsibleRoles,
          priority: newItemPriority,
          guidance: newItemGuidance.trim(),
          allowsNa: newItemAllowsNa,
          weight: newItemWeight,
          active: newItemActive,
          order: category.items.length + 1,
          requiresCommentOnFail: newItemRequiresCommentOnFail,
        },
      ],
    }));

    resetNewItemForm();
  }, [newItemActive, newItemAllowsNa, newItemBlock, newItemDescription, newItemGuidance, newItemPriority, newItemRequired, newItemRequiresCommentOnFail, newItemResponsibleRoles, newItemSector, newItemText, newItemWeight, resetNewItemForm, selectedStructureCategory, updateCategory]);

  const handleDuplicateItem = useCallback((categoryId: string, itemId: string) => {
    const categoryToDuplicate = auditCategories.find((category) => category.id === categoryId);
    if (!categoryToDuplicate) {
      return;
    }

    const currentIndex = categoryToDuplicate.items.findIndex((item) => item.id === itemId);
    if (currentIndex < 0) {
      return;
    }

    const currentItem = categoryToDuplicate.items[currentIndex];
    const duplicatedItem = {
      ...currentItem,
      id: createClientId(),
      text: `${currentItem.text} - copia`,
      order: currentIndex + 2,
    };

    updateCategory(categoryId, (category) => {
      const nextItems = [...category.items];
      nextItems.splice(currentIndex + 1, 0, duplicatedItem);

      return {
        ...category,
        items: nextItems.map((item, index) => ({
          ...item,
          order: index + 1,
        })),
      };
    });
  }, [auditCategories, updateCategory]);

  const handleDeleteItem = useCallback((categoryId: string, itemId: string) => {
    const categoryToDeleteFrom = auditCategories.find((category) => category.id === categoryId);
    if (!categoryToDeleteFrom) {
      return;
    }

    const nextCategories = auditCategories.map((category) => {
      if (category.id === categoryId) {
        const nextItems = category.items
          .filter((item) => item.id !== itemId)
          .map((item, index) => ({
            ...item,
            order: index + 1,
          }));

        return {
          ...category,
          items: nextItems,
        };
      }

      const nextItems = category.items.map((item) => {
        const nextScoreLinks = (item.scoreLinks ?? []).filter((link) => !(
          link.area === categoryToDeleteFrom.name && link.destinationItemId === itemId
        ));

        if (nextScoreLinks.length === (item.scoreLinks ?? []).length) {
          return item;
        }

        return {
          ...item,
          scoreLinks: nextScoreLinks,
          scoreAreas: nextScoreLinks.map((link) => link.area),
        };
      });

      return {
        ...category,
        items: nextItems,
      };
    });

    const nextRules = calculationRules.filter((rule) => !(
      rule.scope === selectedStructureScope
      && (
        (rule.sourceArea === categoryToDeleteFrom.name && rule.sourceItemId === itemId)
        || (rule.targetArea === categoryToDeleteFrom.name && rule.targetItemId === itemId)
      )
    ));
    setCalculationRules(nextRules);
    storeCalculationRules(nextRules);
    persistAuditCategories(nextCategories);
  }, [auditCategories, calculationRules, persistAuditCategories, selectedStructureScope]);

  const handleToggleItemResponsibleRole = useCallback((itemId: string, role: OrResponsibleRole) => {
    if (!selectedStructureCategoryId) return;
    updateCategory(selectedStructureCategoryId, (category) => ({
      ...category,
      items: category.items.map((item) => {
        if (item.id !== itemId) return item;
        const roles = item.responsibleRoles ?? [];
        return {
          ...item,
          responsibleRoles: roles.includes(role) ? roles.filter((value) => value !== role) : [...roles, role],
        };
      }),
    }));
  }, [selectedStructureCategoryId, updateCategory]);

  const handleMoveItem = useCallback((itemId: string, direction: "up" | "down") => {
    if (!selectedStructureCategory) {
      return;
    }

    const currentIndex = selectedStructureCategory.items.findIndex((item) => item.id === itemId);
    if (currentIndex < 0) {
      return;
    }

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= selectedStructureCategory.items.length) {
      return;
    }

    const nextItems = [...selectedStructureCategory.items];
    const [movedItem] = nextItems.splice(currentIndex, 1);
    nextItems.splice(targetIndex, 0, movedItem);

    updateCategory(selectedStructureCategory.id, (category) => ({
      ...category,
      items: nextItems.map((item, index) => ({
        ...item,
        order: index + 1,
      })),
    }));
  }, [selectedStructureCategory, updateCategory]);

  const handleResetStructure = useCallback(() => {
    const defaults = resetAuditCategories(selectedStructureScope);
    setAuditCategoryScopes((current) => ({
      ...current,
      [selectedStructureScope]: defaults,
    }));
    setSelectedStructureCategoryId(defaults[0]?.id || "");
    setReportFilter((current) => ({ ...current, role: defaults[0]?.name || current.role }));
    const nextRules = calculationRules.filter((rule) => rule.scope !== selectedStructureScope);
    setCalculationRules(nextRules);
    storeCalculationRules(nextRules);
    setStructureStorageLabel("local");
    setHasPendingStructureChanges(true);
    alert("Estructura restablecida a la configuración inicial.");
  }, [calculationRules, selectedStructureScope]);

  const handleLoadStructureFromCloud = useCallback(async () => {
    if (!isCloudStructureAvailable) {
      alert("Firebase está desactivado en este entorno. La estructura se administra solo en modo local.");
      return;
    }

    if (!hasAuthenticatedUser) {
      alert("Iniciá sesión para cargar la estructura compartida desde Firestore.");
      return;
    }

    setIsLoadingStructureFromCloud(true);
    try {
      const cloudCategories = await loadAuditCategoriesFromCloud(selectedStructureScope);
      if (!cloudCategories) {
        alert("Todavía no existe una estructura guardada en Firestore.");
        return;
      }

      setAuditCategoryScopes((current) => ({
        ...current,
        [selectedStructureScope]: cloudCategories,
      }));
      saveAuditCategories(cloudCategories, selectedStructureScope);
      setStructureStorageLabel("cloud");
      alert("Estructura cargada desde Firestore.");
    } catch (error) {
      console.error("Manual cloud load failed:", error);
      alert("No se pudo cargar la estructura desde Firestore.");
    } finally {
      setIsLoadingStructureFromCloud(false);
    }
  }, [hasAuthenticatedUser, isCloudStructureAvailable, selectedStructureScope]);

  const handleSaveStructureToCloud = useCallback(async () => {
    if (!isCloudStructureAvailable) {
      alert("Firebase está desactivado en este entorno. La estructura se guarda solo en este dispositivo.");
      return;
    }

    if (!hasAuthenticatedUser) {
      alert("Iniciá sesión para guardar la estructura en Firestore.");
      return;
    }

    setIsSavingStructureToCloud(true);
    try {
      await saveAuditCategoriesToCloud(auditCategories, selectedStructureScope, userEmail);
      setStructureStorageLabel("cloud");
      setHasPendingStructureChanges(false);
      alert("Estructura guardada en Firestore.");
    } catch (error) {
      console.error("Save structure to cloud failed:", error);
      alert("No se pudo guardar la estructura en Firestore. Verificá que tu usuario tenga permisos de administración.");
    } finally {
      setIsSavingStructureToCloud(false);
    }
  }, [auditCategories, hasAuthenticatedUser, isCloudStructureAvailable, selectedStructureScope, userEmail]);

  const handleSaveStructureToSheet = useCallback(async () => {
    const effectiveWebhookUrl = webhookUrl.trim() || localStorage.getItem("webhookUrl") || "";
    const categoriesForScope = auditCategoryScopes[selectedStructureScope];
    const derivedRules = buildCalculationRulesFromLinks(selectedStructureScope, categoriesForScope);
    const rulesForScope = mergeCalculationRules(
      calculationRules.filter((rule) => rule.scope === selectedStructureScope),
      derivedRules,
    );

    if (!effectiveWebhookUrl) {
      alert("No hay una URL de Google Sheets configurada. Cargala en Integraciones.");
      return;
    }

    if (!categoriesForScope.length) {
      alert("No hay áreas para guardar en este alcance.");
      return;
    }

    const scopeLabel = selectedStructureScope === "global" ? "la base compartida" : selectedStructureScope;
    if (!window.confirm(`Se reemplazarán las preguntas y las reglas de cálculo de ${scopeLabel} en Google Sheets. ¿Continuar?`)) {
      return;
    }

    setIsSavingStructureToSheet(true);
    let structureSaved = false;
    try {
      const result = await saveAuditStructureToWebhook(effectiveWebhookUrl, selectedStructureScope, categoriesForScope);
      structureSaved = true;
      const rulesResult = await saveCalculationRulesToWebhook(effectiveWebhookUrl, selectedStructureScope, rulesForScope);
      const nextRules = [
        ...calculationRules.filter((rule) => rule.scope !== selectedStructureScope),
        ...rulesForScope,
      ];
      setCalculationRules(nextRules);
      storeCalculationRules(nextRules);
      setStructureStorageLabel("sheet");
      setHasPendingStructureChanges(false);
      setLastStructureSavedAt(new Date().toISOString());
      alert(`Configuración guardada en Sheets: ${result.categoryCount ?? categoriesForScope.length} áreas, ${result.itemCount ?? 0} preguntas y ${rulesResult.ruleCount ?? rulesForScope.length} vínculos de cálculo.`);
    } catch (error) {
      console.error("Save structure to sheet failed:", error);
      alert(structureSaved
        ? "Las preguntas se guardaron, pero no se pudieron guardar los vínculos en la hoja Reglas de cálculo. Revisá el despliegue de Apps Script y volvé a guardar."
        : "No se pudo guardar la estructura en Google Sheets. Verificá la URL y el despliegue de Apps Script.");
    } finally {
      setIsSavingStructureToSheet(false);
    }
  }, [auditCategoryScopes, calculationRules, selectedStructureScope, webhookUrl]);
  const handleLoadStructureFromSheet = useCallback(async (options: { silent?: boolean } = {}) => {
    const effectiveWebhookUrl = webhookUrl.trim() || localStorage.getItem("webhookUrl") || "";
    if (!effectiveWebhookUrl) {
      if (!options.silent) {
        alert("No hay una URL de Google Sheets configurada. Cargala en Integraciones.");
      }
      return;
    }

    setIsLoadingStructureFromSheet(true);
    try {
      const receivedStructure = await fetchAuditStructureFromWebhook(effectiveWebhookUrl);
      const receivedScopes = receivedStructure.scopes;
      setProcessDefinitions(receivedStructure.processDefinitions);
      const scopes = ["global", "Salta", "Jujuy", "Sin ubicación"] as AuditStructureScope[];
      const normalizedScopes = scopes.reduce((acc, scope) => {
        const categories = receivedScopes[scope];
        if (Array.isArray(categories) && categories.length > 0) {
          acc[scope] = normalizeAuditCategories(categories, { includeMissingDefaults: false });
        }
        return acc;
      }, {} as Partial<Record<AuditStructureScope, AuditCategory[]>>);

      if (Object.keys(normalizedScopes).length === 0) {
        if (!options.silent) {
          alert("Las hojas de auditoría todavía no tienen preguntas activas.");
        }
        return;
      }

      const derivedRules = Object.entries(normalizedScopes).flatMap(([scope, categories]) => (
        categories ? buildCalculationRulesFromLinks(scope as AuditStructureScope, categories) : []
      ));
      const nextCalculationRules = mergeCalculationRules(receivedStructure.calculationRules, derivedRules);
      const recoveredLegacyLinks = nextCalculationRules.length > receivedStructure.calculationRules.length;
      const scopesWithCalculatedTargets = Object.entries(normalizedScopes).reduce((acc, [scope, categories]) => {
        if (categories) {
          acc[scope as AuditStructureScope] = markCalculatedTargets(
            categories,
            nextCalculationRules,
            scope as AuditStructureScope,
          );
        }
        return acc;
      }, {} as Partial<Record<AuditStructureScope, AuditCategory[]>>);

      setCalculationRules(nextCalculationRules);
      storeCalculationRules(nextCalculationRules);
      setAuditCategoryScopes((current) => ({ ...current, ...scopesWithCalculatedTargets }));
      Object.entries(scopesWithCalculatedTargets).forEach(([scope, categories]) => {
        if (categories) {
          saveAuditCategories(categories, scope as AuditStructureScope);
        }
      });
      setStructureStorageLabel("sheet");
      setHasPendingStructureChanges(recoveredLegacyLinks);
      setLastStructureSavedAt(new Date().toISOString());
      if (!options.silent) {
        alert(recoveredLegacyLinks
          ? "Estructura actualizada desde Google Sheets. Se recuperaron vínculos antiguos; usá Guardar en Sheet para pasarlos a Reglas de cálculo."
          : "Preguntas y reglas de cálculo actualizadas desde Google Sheets.");
      }
    } catch (error) {
      console.error("Load structure from sheet failed:", error);
      if (!options.silent) {
        alert("No se pudo leer la estructura de Google Sheets. Revisá la URL y el despliegue de Apps Script.");
      }
    } finally {
      setIsLoadingStructureFromSheet(false);
    }
  }, [webhookUrl]);

  useEffect(() => {
    const effectiveWebhookUrl = webhookUrl.trim() || localStorage.getItem("webhookUrl") || "";
    if (!hasWebhookUrl || !effectiveWebhookUrl || loadedSheetUrlRef.current === effectiveWebhookUrl) {
      return;
    }

    loadedSheetUrlRef.current = effectiveWebhookUrl;
    void handleLoadStructureFromSheet({ silent: true });
  }, [handleLoadStructureFromSheet, hasWebhookUrl, webhookUrl]);
  useEffect(() => {
    if (auditCategories.length === 0) {
      setSelectedStructureCategoryId("");
      return;
    }

    if (!selectedStructureCategoryId || !auditCategories.some((category) => category.id === selectedStructureCategoryId)) {
      setSelectedStructureCategoryId(auditCategories[0].id);
    }

    const allCategoryNames = Array.from(new Set(Object.values(auditCategoryScopes).flatMap((categories) => categories.map((category) => category.name))));

    if (!allCategoryNames.includes(reportFilter.role)) {
      setReportFilter((current) => ({ ...current, role: allCategoryNames[0] || current.role }));
    }

    if (selectedRole && !activeAuditCategories.some((category) => category.name === selectedRole)) {
      setSelectedRole(null);
      setSelectedStaff("");
    }
  }, [activeAuditCategories, auditCategories, auditCategoryScopes, reportFilter.role, selectedRole, selectedStructureCategoryId, setSelectedRole, setSelectedStaff]);

  useEffect(() => {
    if (hasWebhookUrl) {
      return;
    }

    if (!isCloudStructureAvailable || !isAuthReady || !hasAuthenticatedUser) {
      setStructureStorageLabel("local");
      return;
    }

    let cancelled = false;

    const loadStructure = async () => {
      setIsLoadingStructureFromCloud(true);
      try {
        const scopeResults = await Promise.all([
          loadAuditCategoriesFromCloud("global"),
          loadAuditCategoriesFromCloud("Salta"),
          loadAuditCategoriesFromCloud("Jujuy"),
        ]);

        if (cancelled) {
          return;
        }

        const nextScopes: Record<AuditStructureScope, AuditCategory[]> = {
          global: scopeResults[0] ?? getStoredAuditCategories("global"),
          Salta: scopeResults[1] ?? getStoredAuditCategories("Salta"),
          Jujuy: scopeResults[2] ?? getStoredAuditCategories("Jujuy"),
          "Sin ubicación": getStoredAuditCategories("Sin ubicación"),
        };

        setAuditCategoryScopes(nextScopes);
        saveAuditCategories(nextScopes.global, "global");
        saveAuditCategories(nextScopes.Salta, "Salta");
        saveAuditCategories(nextScopes.Jujuy, "Jujuy");
        if (scopeResults.some(Boolean)) {
          setStructureStorageLabel("cloud");
        }
      } catch (error) {
        console.error("Load structure from cloud failed:", error);
      } finally {
        if (!cancelled) {
          setIsLoadingStructureFromCloud(false);
        }
      }
    };

    void loadStructure();

    return () => {
      cancelled = true;
    };
  }, [hasAuthenticatedUser, hasWebhookUrl, isAuthReady, isCloudStructureAvailable]);

  return {
    selectedStructureScope,
    setSelectedStructureScope,
    auditCategoryScopes,
    calculationRules,
    handleToggleCalculationLink,
    processDefinitions,
    auditCategories,
    activeAuditCategories,
    selectedAuditCategory,
    selectedStructureCategory,
    selectedStructureCategoryId,
    setSelectedStructureCategoryId,
    isLoadingStructureFromCloud,
    isSavingStructureToCloud,
    isLoadingStructureFromSheet,
    isSavingStructureToSheet,
    hasPendingStructureChanges,
    structureStorageLabel,
    lastStructureSavedAt,
    reportFilter,
    setReportFilter,
    reportCategoryItems,
    allStaffOptions,
    configuredCategoryCount,
    newCategoryName,
    setNewCategoryName,
    newCategoryDescription,
    setNewCategoryDescription,
    newCategoryStaff,
    setNewCategoryStaff,
    newItemText,
    setNewItemText,
    newItemDescription,
    setNewItemDescription,
    newItemBlock,
    setNewItemBlock,
    newItemSector,
    setNewItemSector,
    newItemResponsibleRoles,
    setNewItemResponsibleRoles,
    newItemPriority,
    setNewItemPriority,
    newItemGuidance,
    setNewItemGuidance,
    newItemRequired,
    setNewItemRequired,
    newItemAllowsNa,
    setNewItemAllowsNa,
    newItemWeight,
    setNewItemWeight,
    newItemActive,
    setNewItemActive,
    newItemRequiresCommentOnFail,
    setNewItemRequiresCommentOnFail,
    allAuditAreaNames,
    updateCategory,
    handleAddCategory,
    handleDuplicateCategory,
    handleDeleteCategory,
    handleAddItem,
    handleDuplicateItem,
    handleDeleteItem,
    handleMoveItem,
    handleToggleItemResponsibleRole,
    handleResetStructure,
    handleLoadStructureFromCloud,
    handleSaveStructureToCloud,
    handleSaveStructureToSheet,
    handleLoadStructureFromSheet,
  };
}
