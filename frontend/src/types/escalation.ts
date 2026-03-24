export type EscalationLevel = "task" | "milestone" | "program" | "client_impact";
export type EscalationStatus = "open" | "acknowledged" | "investigating" | "resolved" | "closed";

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
  response_deadline: string | null;
  is_overdue: boolean;
}

export interface EscalationListResponse {
  escalations: Escalation[];
  total: number;
}

export interface EscalationCreate {
  title: string;
  description?: string;
  entity_type: string;
  entity_id: string;
  level: EscalationLevel;
  program_id?: string;
  client_id?: string;
}

export interface EscalationUpdate {
  status?: EscalationStatus;
  resolution_notes?: string;
}

export interface EscalationTriggerRequest {
  entity_type: string;
  entity_id: string;
  level: EscalationLevel;
  reason: string;
}

export interface EscalationListParams {
  skip?: number;
  limit?: number;
  level?: string;
  status?: string;
  program_id?: string;
  client_id?: string;
}

// ── Metrics ──────────────────────────────────────────────────────────────────

export interface EscalationMetricsParams {
  date_from?: string;
  date_to?: string;
  level?: string;
  status?: string;
  owner_id?: string;
}

export interface EscalationMetricsSummary {
  total: number;
  open: number;
  resolved: number;
  avg_resolution_hours: number | null;
  avg_time_to_response_hours: number | null;
  change_vs_prior_period_pct: number | null;
  prior_period_total: number;
}

export interface EscalationByLevel {
  level: EscalationLevel;
  count: number;
}

export interface EscalationByStatus {
  status: EscalationStatus;
  count: number;
}

export interface EscalationByEntityType {
  entity_type: string;
  count: number;
}

export interface EscalationByAssignee {
  owner_id: string;
  owner_name: string | null;
  owner_email: string | null;
  count: number;
}

export interface EscalationTrendPoint {
  week: string;
  task: number;
  milestone: number;
  program: number;
  client_impact: number;
  total: number;
}

export interface EscalationRecurringPattern {
  entity_type: string;
  entity_id: string;
  level: EscalationLevel;
  count: number;
}

export interface EscalationMetrics {
  summary: EscalationMetricsSummary;
  by_level: EscalationByLevel[];
  by_status: EscalationByStatus[];
  by_entity_type: EscalationByEntityType[];
  by_assignee: EscalationByAssignee[];
  trend: EscalationTrendPoint[];
  recurring_patterns: EscalationRecurringPattern[];
  insights: string[];
}

// ── Simple/Concise Metrics ────────────────────────────────────────────────────

export interface EscalationSimpleMetrics {
  open_by_level: Record<EscalationLevel, number>;
  avg_resolution_time_hours: number | null;
  overdue_count: number;
  sla_compliance_pct: number | null;
  trend_this_week: number;
  trend_last_week: number;
}

export interface OverdueEscalationListResponse {
  escalations: Escalation[];
  total: number;
}
