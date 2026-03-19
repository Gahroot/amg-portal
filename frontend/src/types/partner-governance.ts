export type GovernanceActionType =
  | "warning"
  | "probation"
  | "suspension"
  | "termination"
  | "reinstatement";

export interface GovernanceAction {
  id: string;
  partner_id: string;
  action: GovernanceActionType;
  reason: string;
  evidence: Record<string, unknown> | null;
  effective_date: string;
  expiry_date: string | null;
  issued_by: string;
  issuer_name: string | null;
  partner_firm_name: string | null;
  created_at: string;
}

export interface GovernanceActionCreate {
  action: GovernanceActionType;
  reason: string;
  evidence?: Record<string, unknown>;
  effective_date?: string;
  expiry_date?: string;
}

export interface GovernanceHistoryResponse {
  actions: GovernanceAction[];
  total: number;
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

export interface GovernanceDashboardResponse {
  entries: GovernanceDashboardEntry[];
  total: number;
}
