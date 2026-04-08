/**
 * Partner governance types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/partner_governance.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type GovernanceAction = components["schemas"]["GovernanceActionResponse"];
export type GovernanceHistoryResponse = components["schemas"]["GovernanceHistoryResponse"];
export type GovernanceDashboardResponse = components["schemas"]["GovernanceDashboardResponse"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums, request shapes
// ---------------------------------------------------------------------------

export type GovernanceActionType =
  | "warning"
  | "probation"
  | "suspension"
  | "termination"
  | "reinstatement";

export interface GovernanceActionCreate {
  action: GovernanceActionType;
  reason: string;
  evidence?: Record<string, unknown>;
  effective_date?: string;
  expiry_date?: string;
}

export interface CompositeScore {
  partner_id: string;
  firm_name: string;
  avg_rating_score: number | null;
  sla_compliance_rate: number | null;
  composite_score: number | null;
  total_ratings: number;
  total_sla_tracked: number;
  total_sla_breached: number;
  recommended_action: string | null;
  current_governance_status: string | null;
}

export interface GovernanceDashboardEntry {
  partner_id: string;
  firm_name: string;
  composite_score: number | null;
  current_action: string | null;
  current_action_date: string | null;
  sla_breach_count: number;
  avg_rating: number | null;
  notice_count: number;
}
