export type BudgetApprovalStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "cancelled"
  | "expired";

export type BudgetApprovalStepStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "skipped"
  | "timeout";

export type BudgetRequestType =
  | "budget_increase"
  | "new_expense"
  | "vendor_payment"
  | "partner_payment"
  | "contingency"
  | "scope_change"
  | "emergency";

export interface BudgetApprovalStepResponse {
  id: string;
  request_id: string;
  chain_step_id: string;
  step_number: number;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  assigned_role: string;
  status: BudgetApprovalStepStatus;
  decision: "approved" | "rejected" | null;
  comments: string | null;
  decided_by: string | null;
  decider_name: string | null;
  decided_at: string | null;
  is_timeout: boolean;
  created_at: string;
  updated_at: string;
}

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

export interface BudgetApprovalRequest {
  id: string;
  program_id: string;
  program_title: string;
  request_type: BudgetRequestType;
  title: string;
  description: string | null;
  requested_amount: number;
  budget_impact: number;
  current_budget: number;
  projected_budget: number;
  threshold_id: string;
  threshold_name: string;
  approval_chain_id: string;
  approval_chain_name: string;
  current_step: number;
  total_steps: number;
  status: BudgetApprovalStatus;
  metadata: Record<string, unknown> | null;
  requested_by: string;
  requester_name: string;
  approved_by: string | null;
  approver_name: string | null;
  final_decision_at: string | null;
  final_comments: string | null;
  created_at: string;
  updated_at: string;
  steps: BudgetApprovalStepResponse[];
  history: BudgetApprovalHistoryEntry[];
}

export interface BudgetApprovalRequestSummary {
  id: string;
  program_id: string;
  program_title: string;
  request_type: BudgetRequestType;
  title: string;
  requested_amount: number;
  status: BudgetApprovalStatus;
  current_step: number;
  total_steps: number;
  created_at: string;
  requester_name: string;
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

export interface BudgetApprovalStepDecision {
  decision: "approved" | "rejected";
  comments?: string;
}

export interface BudgetApprovalListParams {
  status?: BudgetApprovalStatus;
  program_id?: string;
  request_type?: BudgetRequestType;
  skip?: number;
  limit?: number;
}

// === Approval Threshold Types ===

export interface ApprovalThreshold {
  id: string;
  name: string;
  description: string | null;
  min_amount: number;
  max_amount: number | null;
  approval_chain_id: string;
  approval_chain_name: string;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface ApprovalThresholdCreate {
  name: string;
  description?: string | null;
  min_amount: number;
  max_amount?: number | null;
  approval_chain_id: string;
  is_active?: boolean;
  priority?: number;
}

export interface ApprovalThresholdUpdate {
  name?: string;
  description?: string | null;
  min_amount?: number;
  max_amount?: number | null;
  approval_chain_id?: string;
  is_active?: boolean;
  priority?: number;
}

// === Approval Chain Types ===

export interface ApprovalChainStep {
  id: string;
  approval_chain_id: string;
  step_number: number;
  required_role: string;
  specific_user_id: string | null;
  specific_user_name: string | null;
  is_parallel: boolean;
  timeout_hours: number | null;
  auto_approve_on_timeout: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApprovalChainStepCreate {
  step_number: number;
  required_role: string;
  specific_user_id?: string | null;
  is_parallel?: boolean;
  timeout_hours?: number | null;
  auto_approve_on_timeout?: boolean;
}

export interface ApprovalChain {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_by: string;
  creator_name: string;
  created_at: string;
  updated_at: string;
  steps: ApprovalChainStep[];
}

export interface ApprovalChainSummary {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  step_count: number;
}

export interface ApprovalChainCreate {
  name: string;
  description?: string | null;
  is_active?: boolean;
  steps?: ApprovalChainStepCreate[];
}

export interface ApprovalChainUpdate {
  name?: string;
  description?: string | null;
  is_active?: boolean;
}
