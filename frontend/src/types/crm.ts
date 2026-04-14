import type { components } from "./generated";

export type Lead = components["schemas"]["LeadResponse"];
export type LeadListResponse = components["schemas"]["LeadListResponse"];
export type LeadCreateData = components["schemas"]["LeadCreate"];
export type LeadUpdateData = components["schemas"]["LeadUpdate"];
export type LeadConvertRequest = components["schemas"]["LeadConvertRequest"];
export type LeadStatus = components["schemas"]["LeadStatus"];
export type LeadSource = components["schemas"]["LeadSource"];
export type ClientType = components["schemas"]["ClientType"];

export type Opportunity = components["schemas"]["OpportunityResponse"];
export type OpportunityListResponse = components["schemas"]["OpportunityListResponse"];
export type OpportunityCreateData = components["schemas"]["OpportunityCreate"];
export type OpportunityUpdateData = components["schemas"]["OpportunityUpdate"];
export type OpportunityReorderRequest = components["schemas"]["OpportunityReorderRequest"];
export type OpportunityStage = components["schemas"]["OpportunityStage"];
export type PipelineSummary = components["schemas"]["PipelineSummary"];

export type CrmActivity = components["schemas"]["CrmActivityResponse"];
export type CrmActivityListResponse = components["schemas"]["CrmActivityListResponse"];
export type CrmActivityCreateData = components["schemas"]["CrmActivityCreate"];
export type CrmActivityUpdateData = components["schemas"]["CrmActivityUpdate"];
export type CrmActivityType = components["schemas"]["CrmActivityType"];

export interface LeadListParams {
  status?: LeadStatus;
  source?: LeadSource;
  owner_id?: string;
  search?: string;
  skip?: number;
  limit?: number;
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

export const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacting", label: "Contacting" },
  { value: "qualifying", label: "Qualifying" },
  { value: "qualified", label: "Qualified" },
  { value: "disqualified", label: "Disqualified" },
  { value: "converted", label: "Converted" },
];

export const LEAD_SOURCES: { value: LeadSource; label: string }[] = [
  { value: "referral_partner", label: "Referral (partner)" },
  { value: "existing_client", label: "Existing client" },
  { value: "inbound_web", label: "Inbound web" },
  { value: "outbound", label: "Outbound" },
  { value: "event", label: "Event" },
  { value: "other", label: "Other" },
];

export const CLIENT_TYPES: { value: ClientType; label: string }[] = [
  { value: "uhnw_individual", label: "UHNW Individual" },
  { value: "family_office", label: "Family Office" },
  { value: "global_executive", label: "Global Executive" },
];

export const OPPORTUNITY_STAGES: { value: OpportunityStage; label: string; color: string }[] = [
  { value: "qualifying", label: "Qualifying", color: "bg-slate-500/10 text-slate-700 dark:text-slate-300" },
  { value: "proposal", label: "Proposal", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  { value: "negotiation", label: "Negotiation", color: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { value: "won", label: "Won", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { value: "lost", label: "Lost", color: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
];

export const ACTIVITY_TYPES: { value: CrmActivityType; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "task", label: "Task" },
];
