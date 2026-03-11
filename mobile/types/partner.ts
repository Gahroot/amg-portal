export type PartnerStatus = 'pending' | 'active' | 'suspended' | 'inactive';
export type PartnerCapability =
  | 'investment_advisory'
  | 'tax_planning'
  | 'estate_planning'
  | 'real_estate'
  | 'art_advisory'
  | 'philanthropy'
  | 'legal'
  | 'insurance'
  | 'concierge'
  | 'security'
  | 'other';
export type AssignmentStatus = 'draft' | 'dispatched' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

export interface Partner {
  id: string;
  user_id: string | null;
  firm_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  capabilities: string[];
  geographies: string[];
  availability_status: string;
  performance_rating: number | null;
  total_assignments: number;
  completed_assignments: number;
  compliance_doc_url: string | null;
  compliance_verified: boolean;
  notes: string | null;
  status: PartnerStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PartnerListResponse {
  profiles: Partner[];
  total: number;
}

export interface PartnerAssignment {
  id: string;
  partner_id: string;
  program_id: string;
  assigned_by: string;
  title: string;
  brief: string;
  sla_terms: string | null;
  status: AssignmentStatus;
  due_date: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  partner_firm_name: string | null;
  program_title: string | null;
}

export interface AssignmentListResponse {
  assignments: PartnerAssignment[];
  total: number;
}
