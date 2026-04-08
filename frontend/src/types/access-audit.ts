/**
 * Access audit types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/access_audit.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type AccessAudit = components["schemas"]["AccessAuditResponse"];
export type AccessAuditListResponse = components["schemas"]["AccessAuditListResponse"];
export type AccessAuditFinding = components["schemas"]["AccessAuditFindingResponse"];
export type AccessAuditFindingListResponse = components["schemas"]["AccessAuditFindingListResponse"];
export type AccessAuditStatistics = components["schemas"]["AccessAuditStatistics"];
export type AcknowledgeFindingRequest = components["schemas"]["AcknowledgeFindingRequest"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums, query params, request shapes
// ---------------------------------------------------------------------------

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
