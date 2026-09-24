export type Location = "Salta" | "Jujuy" | "Sin ubicación";

export type AuditStructureScope = "global" | Location;
export type AuditItemPriority = "high" | "medium" | "low";
export type AuditItemStatus = "pass" | "fail" | "na" | "calculated";
export type AuditItemCalculationMode = "manual" | "calculated";
export type CalculationSourceType = "question" | "or_role" | "or_question" | "or_total";
export type CalculationMethod = "promedio_por_colaborador" | "promedio_por_auditoria";
export type CalculationState = "pending" | "provisional" | "complete" | "not_applicable";
export type AuditUserProfile = "auditor" | "supervisor" | "consulta";
export type AppView = "dashboard" | "home" | "setup" | "audit" | "history" | "structure" | "integrations" | "continuar" | "command-center" | "report" | "stock-control";
export type HistoryPanel = "records" | "exports";
export type AuditSource = "local" | "sheet" | "firestore";

export type OrResponsibleRole =
  | "asesor"
  | "tecnico"
  | "controller"
  | "lavador"
  | "repuestos";

export type OrAuditSector =
  | "recepcion"
  | "taller"
  | "control_calidad"
  | "lavado"
  | "repuestos"
  | "resumen";

export type Role = string;

export interface ScoreLink {
  area: string;
  weight: number;
  sourceItemId?: string;
  sourceItemText?: string;
  destinationItemId?: string;
  destinationItemText?: string;
}

export interface Auditor {
  id: string;
  name: string;
}

export interface AuditTemplateItem {
  id: string;
  text: string;
  required: boolean;
  block?: string;
  priority?: AuditItemPriority;
  guidance?: string;
  requiresCommentOnFail?: boolean;
  description?: string;
  responsibleRoles?: OrResponsibleRole[];
  sector?: OrAuditSector;
  allowsNa?: boolean;
  weight?: number;
  order?: number;
  active?: boolean;
  calculationMode?: AuditItemCalculationMode;
  scoreAreas?: string[];
  scoreLinks?: ScoreLink[];
}

export interface AuditCategory {
  id: string;
  name: string;
  description?: string;
  items: AuditTemplateItem[];
  staffOptions: string[];
}

export interface AuditItem {
  id: string;
  question: string;
  category: Role;
  /**
   * A note or a photo may be started before choosing an outcome. In that
   * case the item remains pending and must never be interpreted as N/A.
   */
  status?: AuditItemStatus;
  comment?: string;
  photoUrl?: string;
  description?: string;
  responsibleRoles?: OrResponsibleRole[];
  sector?: OrAuditSector;
  weight?: number;
  allowsNa?: boolean;
  calculatedScore?: number;
  calculationState?: CalculationState;
  calculationDetail?: string;
  evidenceComment?: string;
  scoreAreas?: string[];
  scoreLinks?: ScoreLink[];
}

export interface OrAuditParticipants {
  asesorServicio: string;
  tecnico: string;
  controller: string;
  lavador: string;
  repuestos?: string;
}

export interface CalculationRule {
  id: string;
  scope: AuditStructureScope;
  active: boolean;
  targetArea: string;
  targetItemId: string;
  sourceType: CalculationSourceType;
  sourceArea?: string;
  sourceItemId?: string;
  sourceRole?: OrResponsibleRole;
  method: CalculationMethod;
  sourceWeight: number;
  minimumCoverage: number;
  detail?: string;
}

export interface CalculatedItemSource {
  name: string;
  score: number | null;
  status: "answered" | "na" | "pending";
}

export interface CalculatedItemResult {
  itemId: string;
  score: number | null;
  state: CalculationState;
  coverage: number;
  coveredCount: number;
  expectedCount: number;
  applicableCount: number;
  minimumCoverage: number;
  detail: string;
  sources: CalculatedItemSource[];
}
export interface ProcessDefinition {
  id: string;
  scope: AuditStructureScope;
  active: boolean;
  name: string;
  areas: string[];
  weights: number[];
  minimumCoverage: number;
  order: number;
}

export interface ProcessResult {
  id: string;
  name: string;
  score: number | null;
  state: CalculationState;
  coveredAreas: number;
  totalAreas: number;
  minimumCoverage: number;
  areaScores: Array<{ area: string; score: number | null }>;
}
export interface AuditRoleScore {
  role: OrResponsibleRole;
  totalApplicableWeight: number;
  obtainedWeight: number;
  compliance: number;
  itemsCount: number;
}

export interface AuditPersonScore {
  role: OrResponsibleRole;
  personName: string;
  compliance: number;
  evaluations: number;
}

export interface AuditSession {
  id: string;
  childAuditIds?: string[];
  childAudits?: AuditSession[];
  date: string;
  auditBatchName?: string;
  /** Objetivo total de unidades que componen la campaña (por ejemplo, 100 OR). */
  sampleTarget?: number;
  /** Nómina preseleccionada para agilizar la carga repetitiva de la campaña. */
  selectedStaffNames?: string[];
  auditorId: string;
  location: Location;
  staffName?: string;
  role?: Role;
  items: AuditItem[];
  totalScore: number;
  orderNumber?: string;
  clientIdentifier?: string;
  auditedFileNames?: string[];
  notes?: string;
  participants?: Partial<OrAuditParticipants>;
  roleScores?: AuditRoleScore[];
  entityType?: "general" | "or";
  userProfile?: AuditUserProfile;
  source?: AuditSource;
}

export interface IncompleteAuditListItem {
  id: string;
  childAuditIds?: string[];
  childAudits?: AuditSession[];
  expectedChildCount?: number;
  date: string;
  auditBatchName?: string;
  sampleTarget?: number;
  selectedStaffNames?: string[];
  auditorId?: string;
  location?: Location;
  staffName?: string;
  role?: Role;
  items: AuditSession["items"];
  updatedAt?: string;
  notes?: string;
  participants?: AuditSession["participants"];
  orderNumber?: string;
  clientIdentifier?: string;
  auditedFileNames?: string[];
  totalScore?: number;
  _source?: "history";
}

export interface CompletedAuditReport {
  role: Role;
  session: AuditSession;
  auditorName?: string;
  templateItems?: AuditTemplateItem[];
}
