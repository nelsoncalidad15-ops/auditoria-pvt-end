import { ASESOR_CHECKLIST_ITEMS, AUDIT_QUESTIONS, OR_CHECKLIST_ITEMS, PRE_DELIVERY_CHECKLIST_ITEMS, STAFF, SUBGERENTE_CHECKLIST_ITEMS } from "../constants";
import { createClientId } from "../lib/utils";
import { AuditCategory, AuditStructureScope, AuditTemplateItem, ScoreLink } from "../types";

function getStorageKey(scope: AuditStructureScope) {
  return `audit-structure-v1:${scope}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || createClientId();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const DEFAULT_SCORE_AREA_RULES = [
  { category: "Técnicos", questionIncludes: "firma en cada campo de diagnostico y reparacion realizada", scoreLinks: [{ area: "Jefe de Taller", weight: 100 }] },
  { category: "Técnicos", questionIncludes: "informa al jefe de taller", scoreLinks: [{ area: "Jefe de Taller", weight: 100 }] },
  { category: "Técnicos", questionIncludes: "se llevan a cabo todas las tareas descriptas en el check list de mantenimiento", scoreLinks: [{ area: "Jefe de Taller", weight: 100 }] },
  { category: "Técnicos", questionIncludes: "bidones de aceite con tapa", scoreLinks: [{ area: "Jefe de Taller", weight: 100 }] },
  { category: "Técnicos", questionIncludes: "productos toxicos y o inflamables rotulados", scoreLinks: [{ area: "Jefe de Taller", weight: 100 }] },
  { category: "Pre Entrega", questionIncludes: "bidones de aceite con tapa", scoreLinks: [{ area: "Jefe de Taller", weight: 100 }] },
] as const;

function getDefaultScoreLinks(categoryName: string, question: string): ScoreLink[] {
  const normalizedCategory = normalizeText(categoryName);
  const normalizedQuestion = normalizeText(question);

  return DEFAULT_SCORE_AREA_RULES
    .filter((rule) => normalizeText(rule.category) === normalizedCategory && normalizedQuestion.includes(rule.questionIncludes))
    .flatMap((rule) => rule.scoreLinks)
    .map((link) => ({ area: link.area, weight: link.weight }));
}

function normalizeScoreLinks(categoryName: string, question: string, scoreLinks: unknown, scoreAreas: unknown) {
  if (Array.isArray(scoreLinks)) {
    return scoreLinks
      .map((link: any) => ({
        area: typeof link?.area === "string" ? link.area.trim() : "",
        weight: Number(link?.weight),
        destinationItemId: typeof link?.destinationItemId === "string" ? link.destinationItemId.trim() : "",
        destinationItemText: typeof link?.destinationItemText === "string" ? link.destinationItemText.trim() : "",
      }))
      .filter((link) => isNonEmptyString(link.area) && Number.isFinite(link.weight) && link.weight > 0)
      .map((link) => ({
        area: link.area,
        weight: Math.min(100, Math.max(1, Math.round(link.weight))),
        destinationItemId: link.destinationItemId,
        destinationItemText: link.destinationItemText,
      }));
  }

  if (Array.isArray(scoreAreas) && scoreAreas.length > 0) {
    const defaultWeight = Math.max(1, Math.round(100 / scoreAreas.length));
    return scoreAreas.filter(isNonEmptyString).map((area) => ({ area, weight: defaultWeight }));
  }

  return getDefaultScoreLinks(categoryName, question);
}

function buildScoreAreas(scoreLinks: ScoreLink[]) {
  return scoreLinks.map((link) => link.area);
}

function buildScoreLinks(categoryName: string, question: string, scoreLinks: unknown, scoreAreas: unknown) {
  const normalizedLinks = normalizeScoreLinks(categoryName, question, scoreLinks, scoreAreas);
  return normalizedLinks.length > 0 ? normalizedLinks : getDefaultScoreLinks(categoryName, question);
}

function buildTemplateItems(name: string, items: AuditTemplateItem[]): AuditTemplateItem[] {
  return items.map((item, index) => ({
    ...item,
    id: item.id || `${slugify(name)}-${index + 1}`,
    text: item.text,
    required: false,
    block: item.block || "General",
    priority: item.priority || "medium",
    guidance: item.guidance || "",
    requiresCommentOnFail: typeof item.requiresCommentOnFail === "boolean" ? item.requiresCommentOnFail : false,
    description: item.description || "",
    responsibleRoles: Array.isArray(item.responsibleRoles) ? item.responsibleRoles : [],
    sector: item.sector || "resumen",
    allowsNa: typeof item.allowsNa === "boolean" ? item.allowsNa : true,
    weight: typeof item.weight === "number" ? item.weight : 1,
    order: typeof item.order === "number" ? item.order : index + 1,
    active: typeof item.active === "boolean" ? item.active : true,
    scoreLinks: (() => {
      const normalizedLinks = buildScoreLinks(name, item.text, item.scoreLinks, item.scoreAreas);
      return normalizedLinks;
    })(),
    scoreAreas: (() => {
      const normalizedLinks = buildScoreLinks(name, item.text, item.scoreLinks, item.scoreAreas);
      return buildScoreAreas(normalizedLinks);
    })(),
  }));
}

function getCategoryDefaultItems(name: string, questions: string[]): AuditTemplateItem[] {
  if (name === "Ordenes") {
    return buildTemplateItems(name, OR_CHECKLIST_ITEMS);
  }

  if (name === "Pre Entrega") {
    return buildTemplateItems(name, PRE_DELIVERY_CHECKLIST_ITEMS);
  }

  if (name === "Subgerente de servicio") {
    return buildTemplateItems(name, SUBGERENTE_CHECKLIST_ITEMS);
  }

  if (name === "Asesores de servicio") {
    return buildTemplateItems(name, ASESOR_CHECKLIST_ITEMS);
  }

  return questions.map((question, index) => ({
    id: `${slugify(name)}-${index + 1}`,
    text: question,
    required: false,
    block: "General",
    priority: "medium" as const,
    guidance: "",
    requiresCommentOnFail: false,
    description: "",
    responsibleRoles: [],
    sector: "resumen" as const,
    allowsNa: true,
    weight: 1,
    order: index + 1,
    active: true,
    scoreLinks: getDefaultScoreLinks(name, question),
    scoreAreas: getDefaultScoreLinks(name, question).map((link) => link.area),
  }));
}

function shouldUpgradePreDeliveryCategory(category: any) {
  if (category?.name !== "Pre Entrega" || !Array.isArray(category?.items)) {
    return false;
  }

  const itemTexts = category.items.map((item: any) => String(item?.text || ""));
  const hasLegacyOnlyItems = itemTexts.includes("Lavado 24hs antes de la entrega.") || itemTexts.includes("Fecha y registro de contactos con clientes de pre entrega.");
  const hasNewDocumentaryItem = itemTexts.some((text: string) => text.includes("3 planes") || text.includes("Vale a Taller") || text.includes("3 de tradicional"));

  return hasLegacyOnlyItems && !hasNewDocumentaryItem;
}

export function getDefaultAuditCategories(): AuditCategory[] {
  return Object.entries(AUDIT_QUESTIONS).map(([name, questions]) => ({
    id: slugify(name),
    name,
    description: "",
    staffOptions: STAFF[name] ?? [],
    items: getCategoryDefaultItems(name, questions),
  }));
}

export function normalizeAuditCategories(categories: AuditCategory[] | unknown): AuditCategory[] {
  const defaultCategories = getDefaultAuditCategories();

  if (!Array.isArray(categories) || categories.length === 0) {
    return defaultCategories;
  }

  return categories.map((category: any) => {
    const defaultCategory = defaultCategories.find((item) => item.name === category.name);
    const shouldUpgradeCategory = shouldUpgradePreDeliveryCategory(category);

    return ({
    id: category.id || slugify(category.name),
    name: category.name,
    description: typeof category.description === "string" ? category.description : "",
    staffOptions: Array.isArray(category.staffOptions) ? category.staffOptions : [],
    items: shouldUpgradeCategory && defaultCategory
      ? defaultCategory.items
      : Array.isArray(category.items)
      ? category.items.map((item: any, index: number) => ({
          id: item.id || `${slugify(category.name)}-${index + 1}`,
          text: item.text,
          required: false,
          block: typeof item.block === "string" && item.block.trim() ? item.block.trim() : "General",
          priority: item.priority === "high" || item.priority === "medium" || item.priority === "low" ? item.priority : "medium",
          guidance: typeof item.guidance === "string" ? item.guidance : "",
          requiresCommentOnFail: typeof item.requiresCommentOnFail === "boolean" ? item.requiresCommentOnFail : false,
          description: typeof item.description === "string" ? item.description : "",
          responsibleRoles: Array.isArray(item.responsibleRoles) ? item.responsibleRoles : [],
          sector: typeof item.sector === "string" && item.sector.trim() ? item.sector : "resumen",
          allowsNa: typeof item.allowsNa === "boolean" ? item.allowsNa : true,
          weight: typeof item.weight === "number" ? item.weight : 1,
          order: typeof item.order === "number" ? item.order : index + 1,
          active: typeof item.active === "boolean" ? item.active : true,
          scoreLinks: (() => {
            const normalizedLinks = buildScoreLinks(category.name, item.text, item.scoreLinks, item.scoreAreas);
            return normalizedLinks;
          })(),
          scoreAreas: (() => {
            const normalizedLinks = buildScoreLinks(category.name, item.text, item.scoreLinks, item.scoreAreas);
            return buildScoreAreas(normalizedLinks);
          })(),
        }))
      : [],
  });
  });
}

export function getStoredAuditCategories(scope: AuditStructureScope = "global"): AuditCategory[] {
  try {
    const rawValue = localStorage.getItem(getStorageKey(scope));
    if (!rawValue) {
      return getDefaultAuditCategories();
    }

    return normalizeAuditCategories(JSON.parse(rawValue) as AuditCategory[]);
  } catch {
    return getDefaultAuditCategories();
  }
}

export function saveAuditCategories(categories: AuditCategory[], scope: AuditStructureScope = "global") {
  localStorage.setItem(getStorageKey(scope), JSON.stringify(categories));
}

export function resetAuditCategories(scope: AuditStructureScope = "global") {
  const defaults = getDefaultAuditCategories();
  saveAuditCategories(defaults, scope);
  return defaults;
}

