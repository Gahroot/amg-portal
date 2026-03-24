export interface Approval {
  id: string;
  program_id: string;
  approval_type: string;
  requested_by: string;
  requester_name: string;
  approved_by: string | null;
  approver_name: string | null;
  status: "pending" | "approved" | "rejected";
  comments: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRequest {
  program_id: string;
  approval_type: "standard" | "elevated" | "strategic" | "emergency";
  comments?: string;
}

export interface ApprovalDecision {
  status: "approved" | "rejected";
  comments?: string;
}

export interface ApprovalListParams {
  skip?: number;
  limit?: number;
}

// ─── Approval Comment Types ──────────────────────────────────────────────────

export interface ApprovalComment {
  id: string;
  entity_type: string;
  entity_id: string;
  parent_id: string | null;
  author_id: string;
  author_name: string;
  content: string;
  is_internal: boolean;
  mentioned_user_ids: string[];
  created_at: string;
  updated_at: string;
  replies: ApprovalComment[];
}

export interface ApprovalCommentCreate {
  content: string;
  is_internal?: boolean;
  parent_id?: string | null;
  mentioned_user_ids?: string[];
}

export interface ApprovalCommentThread {
  entity_type: string;
  entity_id: string;
  total: number;
  comments: ApprovalComment[];
}
