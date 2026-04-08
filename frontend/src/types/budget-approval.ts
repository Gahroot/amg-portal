/**
 * Budget approval types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/budget_approval.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type BudgetApprovalStatus = components["schemas"]["BudgetApprovalStatus"];
export type BudgetRequestType = components["schemas"]["BudgetRequestType"];
export type BudgetApprovalStepResponse = components["schemas"]["BudgetApprovalStepResponse"];
export type BudgetApprovalStepDecision = components["schemas"]["BudgetApprovalStepDecision"];
export type BudgetApprovalRequest = components["schemas"]["BudgetApprovalRequestResponse"];
export type BudgetApprovalRequestSummary = components["schemas"]["BudgetApprovalRequestSummary"];
export type BudgetApprovalHistoryResponse = components["schemas"]["BudgetApprovalHistoryResponse"];

// Approval Chain types
export type ApprovalChainStep = components["schemas"]["ApprovalChainStepResponse"];
export type ApprovalChainStepCreate = components["schemas"]["ApprovalChainStepCreate"];
export type ApprovalChain = components["schemas"]["ApprovalChainResponse"];
export type ApprovalChainSummary = components["schemas"]["ApprovalChainSummary"];
export type ApprovalChainCreate = components["schemas"]["ApprovalChainCreate"];
export type ApprovalChainUpdate = components["schemas"]["ApprovalChainUpdate"];

// Approval Threshold types
export type ApprovalThreshold = components["schemas"]["ApprovalThresholdResponse"];
export type ApprovalThresholdCreate = components["schemas"]["ApprovalThresholdCreate"];
export type ApprovalThresholdUpdate = components["schemas"]["ApprovalThresholdUpdate"];

// ---------------------------------------------------------------------------
// Frontend-only types — query params, display helpers
// ---------------------------------------------------------------------------

export type BudgetApprovalStepStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "skipped"
  | "timeout";

export interface BudgetApprovalHistoryEntry {
  id: string;
  request_id: string;
  action: string;
  step_number: number | null;
  from_status: string | null;
  to_status: string | null;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  comments: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface PaginatedBudgetApprovalRequests {
  items: BudgetApprovalRequestSummary[];
  total: number;
  skip: number;
  limit: number;
}

export interface PendingApprovalItem {
  id: string;
  request_id: string;
  request_title: string;
  request_type: BudgetRequestType;
  program_id: string;
  program_title: string;
  requested_amount: number;
  step_number: number;
  status: BudgetApprovalStepStatus;
  created_at: string;
  requester_name: string;
}

export interface PendingApprovalsResponse {
  items: PendingApprovalItem[];
  total: number;
}

export interface BudgetApprovalListParams {
  status?: BudgetApprovalStatus;
  program_id?: string;
  request_type?: BudgetRequestType;
  skip?: number;
  limit?: number;
}
