export type EscalationLevel = 'task' | 'milestone' | 'program' | 'client_impact';
export type EscalationStatus = 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'closed';

export interface Escalation {
  id: string;
  level: EscalationLevel;
  status: EscalationStatus;
  title: string;
  description: string | null;
  entity_type: string;
  entity_id: string;
  owner_id: string;
  owner_email: string | null;
  owner_name: string | null;
  program_id: string | null;
  client_id: string | null;
  triggered_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  triggered_by: string;
  triggered_by_email: string | null;
  triggered_by_name: string | null;
  risk_factors: Record<string, unknown> | null;
  escalation_chain: Record<string, unknown>[] | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EscalationListResponse {
  escalations: Escalation[];
  total: number;
}

export interface EscalationListParams {
  skip?: number;
  limit?: number;
  level?: string;
  status?: string;
  program_id?: string;
  client_id?: string;
}
