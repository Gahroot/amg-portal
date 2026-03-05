export type ComplianceStatus = "pending_review" | "under_review" | "cleared" | "flagged" | "rejected";
export type ApprovalStatus = "draft" | "pending_compliance" | "compliance_cleared" | "pending_md_approval" | "approved" | "rejected";

export interface ClientProfile {
  id: string;
  legal_name: string;
  display_name: string | null;
  entity_type: string | null;
  jurisdiction: string | null;
  tax_id: string | null;
  primary_email: string;
  secondary_email: string | null;
  phone: string | null;
  address: string | null;
  communication_preference: string | null;
  sensitivities: string | null;
  special_instructions: string | null;
  compliance_status: ComplianceStatus;
  approval_status: ApprovalStatus;
  compliance_notes: string | null;
  compliance_reviewed_by: string | null;
  compliance_reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  assigned_rm_id: string | null;
  intelligence_file: Record<string, unknown> | null;
  user_id: string | null;
  welcome_email_sent: boolean;
  portal_access_enabled: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface ClientProfileListResponse {
  profiles: ClientProfile[];
  total: number;
}

export interface ClientProfileCreateData {
  legal_name: string;
  display_name?: string;
  entity_type?: string;
  jurisdiction?: string;
  tax_id?: string;
  primary_email: string;
  secondary_email?: string;
  phone?: string;
  address?: string;
  communication_preference?: string;
  sensitivities?: string;
  special_instructions?: string;
}

export interface ClientProfileUpdateData extends Partial<ClientProfileCreateData> {}

export interface ComplianceReviewData {
  status: "cleared" | "flagged" | "rejected";
  notes: string;
}

export interface MDApprovalData {
  approved: boolean;
  notes?: string;
  assigned_rm_id?: string;
}

export interface ClientProvisionData {
  send_welcome_email: boolean;
  password?: string;
}

export interface ComplianceCertificate {
  profile_id: string;
  legal_name: string;
  compliance_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  certificate_date: string;
}

export interface ClientPortalProfile {
  id: string;
  legal_name: string;
  display_name: string | null;
  entity_type: string | null;
  jurisdiction: string | null;
  primary_email: string;
  compliance_status: ComplianceStatus;
  approval_status: ApprovalStatus;
  created_at: string;
}

export interface ClientListParams {
  compliance_status?: string;
  approval_status?: string;
  assigned_rm_id?: string;
  search?: string;
  skip?: number;
  limit?: number;
}
