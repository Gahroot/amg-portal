/**
 * Approval types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/approval.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type Approval = components["schemas"]["ApprovalResponse"];
export type ApprovalRequest = components["schemas"]["ApprovalRequest"];
export type ApprovalDecision = components["schemas"]["ApprovalDecision"];
export type ApprovalComment = components["schemas"]["ApprovalCommentResponse"];
export type ApprovalCommentCreate = components["schemas"]["ApprovalCommentCreate"];
export type ApprovalCommentThread = components["schemas"]["ApprovalCommentThreadResponse"];

// ---------------------------------------------------------------------------
// Frontend-only types — query params
// ---------------------------------------------------------------------------

export interface ApprovalListParams {
  skip?: number;
  limit?: number;
}
