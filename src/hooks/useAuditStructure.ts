import { useCallback, useEffect, useState } from "react";
import { createClientId } from "../lib/utils";
import { loadAuditCategoriesFromCloud, saveAuditCategoriesToCloud } from "../services/audit-structure-cloud";
import { sendStructureToWebhook } from "../services/audit-sync";
import { getStoredAuditCategories, resetAuditCategories, saveAuditCategories } from "../services/audit-structure";
import {
  AuditCategory,
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
}

const createInitialScopes = (): Record<AuditStructureScope, AuditCategory[]> => ({
  global: getStoredAuditCategories("global"),
  Salta: getStoredAuditCategories("Salta"),
  Jujuy: getStoredAuditCategories("Jujuy"),
});

const createInitialReportFilter = () => ({
  role: getStoredAuditCategories("global")[0]?.name || "Ordenes",
  staff: "",
  month: new Date().toISOString().slice(0, 7),
});

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
  const [isSavingStructureToSheet, setIsSavingStructureToSheet] = useState(false);
  const [structureStorageLabel, setStructureStorageLabel] = useState<"local" | "cloud" | "sheet">("local");
  const [lastStructureSavedAt, setLastStructureSavedAt] = useState<string | null>(null);
  const [hasPendingStructureChanges, setHasPendingStructureChanges] = useState(false);
  const [reportFilter, setReportFilter] = useState(createInitialReportFilter);

  const auditCategories = auditCategoryScopes[selectedStructureScope] ?? auditCategoryScopes.global;
  const activeAuditCategories = (sessionLocation ? auditCategoryScopes[sessionLocation] : null) ?? auditCategoryScopes.global;
  const selectedAuditCategory = selectedRole
    ? activeAuditCategories.find((category) => category.name === selectedRole) ?? null
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
  }, [auditCategories, persistAuditCategories, reportFilter.role, selectedRole, selectedStructureCategoryId, setSelectedRole, setSelectedStaff]);

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

    persistAuditCategories(nextCategories);
  }, [auditCategories, persistAuditCategories]);

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
    setStructureStorageLabel("local");
    alert("Estructura restablecida a la configuración inicial.");
  }, [selectedStructureScope]);

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
    const effectiveWebhookUrl = webhookUrl || getStoredWebhookUrl();
    if (!effectiveWebhookUrl) {
      alert("No hay una URL de Webhook configurada para el Sheet. Por favor, configúrala en la sección de Integraciones.");
      return;
    }

    setIsSavingStructureToSheet(true);
    try {
      await sendStructureToWebhook(effectiveWebhookUrl, {
        event: "structure_update",
        scope: selectedStructureScope,
        data: JSON.stringify(auditCategories),
        updatedByEmail: userEmail ?? "anónimo",
      });
      setStructureStorageLabel("sheet");
      setHasPendingStructureChanges(false);
      setLastStructureSavedAt(new Date().toISOString());
      alert("Estructura enviada al Sheet correctamente.");
    } catch (error) {
      console.error("Save structure to sheet failed:", error);
      alert("No se pudo enviar la estructura al Sheet. Verificá tu conexión.");
    } finally {
      setIsSavingStructureToSheet(false);
    }
  }, [auditCategories, hasWebhookUrl, selectedStructureScope, userEmail, webhookUrl]);

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
  }, [hasAuthenticatedUser, isAuthReady, isCloudStructureAvailable]);

  return {
    selectedStructureScope,
    setSelectedStructureScope,
    auditCategoryScopes,
    auditCategories,
    activeAuditCategories,
    selectedAuditCategory,
    selectedStructureCategory,
    selectedStructureCategoryId,
    setSelectedStructureCategoryId,
    isLoadingStructureFromCloud,
    isSavingStructureToCloud,
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
    handleResetStructure,
    handleLoadStructureFromCloud,
    handleSaveStructureToCloud,
    handleSaveStructureToSheet,
  };
}
