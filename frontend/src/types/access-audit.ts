export type FindingType =
  | "excessive_access"
  | "inactive_user"
  | "role_mismatch"
  | "expired_credentials"
  | "policy_violation"
  | "unapproved_access"
  | "orphaned_account"
  | "other";

export type FindingSeverity = "low" | "medium" | "high" | "critical";

export type FindingStatus =
  | "open"
  | "acknowledged"
  | "in_progress"
  | "remediated"
  | "waived"
  | "closed";

export interface AccessAuditFinding {
  id: string;
  audit_id: string;
  user_id: string | null;
  finding_type: FindingType;
  severity: FindingSeverity;
  description: string;
  recommendation: string | null;
  status: FindingStatus;
  remediation_notes: string | null;
  remediated_by: string | null;
  remediated_at: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  waived_reason: string | null;
  waived_by: string | null;
  waived_at: string | null;
  created_at: string;
  updated_at: string;
  user_email: string | null;
  user_name: string | null;
  remediator_name: string | null;
}

export interface AccessAudit {
  id: string;
  audit_period: string;
  quarter: number;
  year: number;
  status: "draft" | "in_review" | "completed";
  auditor_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  users_reviewed: number;
  permissions_verified: number;
  anomalies_found: number;
  summary: string | null;
  recommendations: string | null;
  created_at: string;
  updated_at: string;
  auditor_name: string | null;
  findings: AccessAuditFinding[];
}

export interface AccessAuditListResponse {
  audits: AccessAudit[];
  total: number;
}

export interface AccessAuditFindingListResponse {
  findings: AccessAuditFinding[];
  total: number;
}

export interface AccessAuditStatistics {
  total: number;
  draft: number;
  in_review: number;
  completed: number;
  total_findings: number;
  open_findings: number;
  remediated_findings: number;
  waived_findings: number;
  by_severity: Record<string, number>;
  by_quarter: Record<string, number>;
}

export interface CreateAccessAuditRequest {
  quarter: number;
  year: number;
  auditor_id?: string;
  summary?: string;
}

export interface UpdateAccessAuditRequest {
  status?: string;
  auditor_id?: string;
  users_reviewed?: number;
  permissions_verified?: number;
  anomalies_found?: number;
  summary?: string;
  recommendations?: string;
}

export interface CreateAccessAuditFindingRequest {
  user_id?: string;
  finding_type: FindingType;
  severity?: FindingSeverity;
  description: string;
  recommendation?: string;
}

export interface UpdateAccessAuditFindingRequest {
  finding_type?: FindingType;
  severity?: FindingSeverity;
  description?: string;
  recommendation?: string;
  status?: FindingStatus;
  remediation_notes?: string;
}

export interface RemediateFindingRequest {
  remediation_notes?: string;
}

export interface AcknowledgeFindingRequest {
  notes?: string;
}

export interface WaiveFindingRequest {
  waived_reason: string;
}

export interface AccessAuditListParams {
  skip?: number;
  limit?: number;
  status?: string;
  year?: number;
}

export interface AuditFindingListParams {
  skip?: number;
  limit?: number;
  status?: string;
  severity?: string;
  finding_type?: string;
}
