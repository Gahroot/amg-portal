export type ApprovalType = 'standard' | 'elevated' | 'strategic' | 'emergency';
export type ProgramApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Approval {
  id: string;
  program_id: string;
  approval_type: ApprovalType;
  requested_by: string;
  approved_by: string | null;
  status: ProgramApprovalStatus;
  comments: string | null;
  requester_name: string;
  approver_name: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRequestData {
  program_id: string;
  approval_type: ApprovalType;
  comments?: string;
}

export interface ApprovalDecisionData {
  status: 'approved' | 'rejected';
  comments?: string;
}
