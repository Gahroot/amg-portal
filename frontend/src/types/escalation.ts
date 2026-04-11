/**
 * Escalation types — re-exported from generated OpenAPI types where possible.
 *
 * API types are sourced from generated.ts (auto-generated from FastAPI OpenAPI schema).
 * Frontend-only types (query params, metrics display) remain manual.
 *
 * To refresh: npm run generate:types (requires backend at localhost:8000)
 *
 * @see backend/app/schemas/escalation.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type Escalation = components["schemas"]["EscalationResponse"];
export type EscalationListResponse = components["schemas"]["EscalationListResponse"];
export type EscalationCreate = components["schemas"]["EscalationCreate"];
export type EscalationMetrics = components["schemas"]["EscalationMetricsResponse"];
export type EscalationUpdate = components["schemas"]["EscalationUpdate"];
export type EscalationTriggerRequest = components["schemas"]["EscalationTriggerRequest"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums, query params, display helpers
// ---------------------------------------------------------------------------

export type EscalationLevel = "task" | "milestone" | "program" | "client_impact";
export type EscalationStatus = "open" | "acknowledged" | "investigating" | "resolved" | "closed";

export interface EscalationListParams {
  skip?: number;
  limit?: number;
  level?: string;
  status?: string;
  program_id?: string;
  client_id?: string;
}

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

/**
 * Detailed metrics response used by the EscalationMetricsDashboard.
 * This extends the generated EscalationMetricsResponse with additional
 * properties that may be provided by the backend metrics endpoint.
 */
export interface EscalationDetailedMetrics {
  summary: EscalationMetricsSummary;
  by_level: EscalationByLevel[];
  by_status: EscalationByStatus[];
  trend: EscalationTrendPoint[];
  by_assignee: EscalationByAssignee[];
  recurring_patterns: EscalationRecurringPattern[];
  insights: string[];
}

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
