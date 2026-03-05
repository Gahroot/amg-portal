export type CommunicationType = "email" | "portal_message" | "phone" | "partner_submission" | "client_inquiry";
export type SLABreachStatus = "within_sla" | "approaching_breach" | "breached";

export interface SLATracker {
  id: string;
  entity_type: string;
  entity_id: string;
  communication_type: CommunicationType;
  sla_hours: number;
  started_at: string;
  responded_at: string | null;
  breach_status: SLABreachStatus;
  assigned_to: string;
  assigned_to_email: string | null;
  assigned_to_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface SLATrackerListResponse {
  trackers: SLATracker[];
  total: number;
}

export interface SLACreate {
  entity_type: string;
  entity_id: string;
  communication_type: CommunicationType;
  sla_hours?: number;
  assigned_to: string;
}

export interface SLAListParams {
  skip?: number;
  limit?: number;
  breach_status?: string;
  entity_type?: string;
}

export interface SLABreachAlertResponse {
  id: string;
  entity_type: string;
  entity_id: string;
  communication_type: CommunicationType;
  sla_hours: number;
  started_at: string;
  breach_status: SLABreachStatus;
  assigned_to: string;
  hours_elapsed: number;
  hours_remaining: number | null;
  overdue_hours: number | null;
}
