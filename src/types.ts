export type Location = "Salta" | "Jujuy";

export type AuditStructureScope = "global" | Location;
export type AuditItemPriority = "high" | "medium" | "low";
export type AuditItemStatus = "pass" | "fail" | "na";
export type AuditUserProfile = "auditor" | "supervisor" | "consulta";
export type AppView = "dashboard" | "home" | "setup" | "audit" | "history" | "structure" | "integrations" | "continuar" | "command-center";
export type HistoryPanel = "records" | "exports";

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
  status: AuditItemStatus;
  comment?: string;
  photoUrl?: string;
  description?: string;
  responsibleRoles?: OrResponsibleRole[];
  sector?: OrAuditSector;
  weight?: number;
  allowsNa?: boolean;
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
  date: string;
  auditBatchName?: string;
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
}

export interface IncompleteAuditListItem {
  id: string;
  date: string;
  auditBatchName?: string;
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
