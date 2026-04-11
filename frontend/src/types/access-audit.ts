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
export type CreateAccessAuditRequest = components["schemas"]["CreateAccessAuditRequest"];
export type UpdateAccessAuditRequest = components["schemas"]["UpdateAccessAuditRequest"];
export type CreateAccessAuditFindingRequest = components["schemas"]["CreateAccessAuditFindingRequest"];
export type UpdateAccessAuditFindingRequest = components["schemas"]["UpdateAccessAuditFindingRequest"];
export type RemediateFindingRequest = components["schemas"]["RemediateFindingRequest"];
export type WaiveFindingRequest = components["schemas"]["WaiveFindingRequest"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums, query params
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
