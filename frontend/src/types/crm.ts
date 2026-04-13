export const LEAD_STATUSES = [
  { value: "new", label: "New" },
  { value: "contacting", label: "Contacting" },
  { value: "qualifying", label: "Qualifying" },
  { value: "qualified", label: "Qualified" },
  { value: "disqualified", label: "Disqualified" },
  { value: "converted", label: "Converted" },
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["value"];

export const LEAD_SOURCES = [
  { value: "referral_partner", label: "Referral (partner)" },
  { value: "existing_client", label: "Existing client" },
  { value: "inbound_web", label: "Inbound web" },
  { value: "outbound", label: "Outbound" },
  { value: "event", label: "Event" },
  { value: "other", label: "Other" },
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number]["value"];

export const CLIENT_TYPES = [
  { value: "uhnw_individual", label: "UHNW Individual" },
  { value: "family_office", label: "Family Office" },
  { value: "global_executive", label: "Global Executive" },
] as const;

export type ClientType = (typeof CLIENT_TYPES)[number]["value"];

export const OPPORTUNITY_STAGES = [
  { value: "qualifying", label: "Qualifying", color: "bg-slate-500/10 text-slate-700 dark:text-slate-300" },
  { value: "proposal", label: "Proposal", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  { value: "negotiation", label: "Negotiation", color: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { value: "won", label: "Won", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { value: "lost", label: "Lost", color: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number]["value"];

export const ACTIVITY_TYPES = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "task", label: "Task" },
] as const;

export type CrmActivityType = (typeof ACTIVITY_TYPES)[number]["value"];

export interface Lead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: LeadStatus;
  source: LeadSource;
  source_details: string | null;
  estimated_value: string | null;
  estimated_client_type: ClientType | null;
  owner_id: string;
  referred_by_partner_id: string | null;
  notes: string | null;
  disqualified_reason: string | null;
  converted_at: string | null;
  converted_client_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadListResponse {
  leads: Lead[];
  total: number;
}

export interface LeadCreateData {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  status?: LeadStatus;
  source?: LeadSource;
  source_details?: string | null;
  estimated_value?: string | null;
  estimated_client_type?: ClientType | null;
  referred_by_partner_id?: string | null;
  notes?: string | null;
}

export type LeadUpdateData = Partial<LeadCreateData> & {
  disqualified_reason?: string | null;
};

export interface LeadConvertRequest {
  legal_name: string;
  primary_email: string;
  entity_type: ClientType;
  phone?: string | null;
  notes?: string | null;
}

export interface LeadListParams {
  status?: LeadStatus;
  source?: LeadSource;
  owner_id?: string;
  search?: string;
  skip?: number;
  limit?: number;
}

export interface Opportunity {
  id: string;
  title: string;
  description: string | null;
  stage: OpportunityStage;
  position: number;
  value: string | null;
  probability: number;
  expected_close_date: string | null;
  program_type: string | null;
  next_step: string | null;
  next_step_at: string | null;
  owner_id: string;
  lead_id: string | null;
  client_profile_id: string | null;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpportunityListResponse {
  opportunities: Opportunity[];
  total: number;
}

export interface OpportunityCreateData {
  title: string;
  description?: string | null;
  stage?: OpportunityStage;
  value?: string | null;
  probability?: number;
  expected_close_date?: string | null;
  program_type?: string | null;
  next_step?: string | null;
  next_step_at?: string | null;
  lead_id?: string | null;
  client_profile_id?: string | null;
}

export type OpportunityUpdateData = Partial<OpportunityCreateData> & {
  lost_reason?: string | null;
};

export interface OpportunityReorderRequest {
  new_stage: OpportunityStage;
  after_opportunity_id: string | null;
}

export interface PipelineSummary {
  stage: OpportunityStage;
  count: number;
  total_value: string;
  weighted_value: string;
}

export interface OpportunityListParams {
  stage?: OpportunityStage;
  owner_id?: string;
  lead_id?: string;
  client_profile_id?: string;
  search?: string;
  skip?: number;
  limit?: number;
}

export interface CrmActivity {
  id: string;
  type: CrmActivityType;
  subject: string;
  body: string | null;
  occurred_at: string;
  lead_id: string | null;
  opportunity_id: string | null;
  client_profile_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CrmActivityListResponse {
  activities: CrmActivity[];
  total: number;
}

export interface CrmActivityCreateData {
  type?: CrmActivityType;
  subject: string;
  body?: string | null;
  occurred_at?: string | null;
  lead_id?: string | null;
  opportunity_id?: string | null;
  client_profile_id?: string | null;
}

export type CrmActivityUpdateData = Partial<
  Pick<CrmActivityCreateData, "type" | "subject" | "body" | "occurred_at">
>;
