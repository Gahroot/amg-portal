export type RiskStatus = "healthy" | "at_risk" | "critical";
export type TrendDirection = "improving" | "stable" | "declining";

export interface RiskFactors {
  overdue_task_ratio: number;
  sla_breach_count: number;
  open_escalation_count: number;
  budget_variance: number;
  avg_nps_score: number | null;
}

export interface RiskScoreResponse {
  program_id: string;
  program_title: string;
  client_id: string;
  client_name: string;
  risk_score: number;
  risk_status: RiskStatus;
  trend: TrendDirection;
  factors: RiskFactors;
  program_status: string;
  updated_at: string;
}

export interface ProgramHealthSummary {
  program_id: string;
  program_title: string;
  client_id: string;
  client_name: string;
  risk_score: number;
  risk_status: RiskStatus;
  trend: TrendDirection;
  factors: RiskFactors;
  total_tasks: number;
  overdue_tasks: number;
  total_sla_trackers: number;
  breached_sla_count: number;
  open_escalations: number;
  budget_envelope: number | null;
  budget_consumed: number | null;
  latest_nps_score: number | null;
  program_status: string;
  start_date: string | null;
  end_date: string | null;
  updated_at: string;
}

export interface RiskForecastListResponse {
  programs: RiskScoreResponse[];
  total: number;
  healthy_count: number;
  at_risk_count: number;
  critical_count: number;
}

export interface ClientRiskOverview {
  client_id: string;
  client_name: string;
  total_programs: number;
  healthy_count: number;
  at_risk_count: number;
  critical_count: number;
  avg_risk_score: number;
  highest_risk_program: RiskScoreResponse | null;
  programs: RiskScoreResponse[];
  updated_at: string;
}

export interface RiskAlertItem {
  program_id: string;
  program_title: string;
  client_id: string;
  client_name: string;
  risk_score: number;
  risk_status: RiskStatus;
  trend: TrendDirection;
  primary_driver: string;
  factors: RiskFactors;
  updated_at: string;
}

export interface RiskAlertListResponse {
  alerts: RiskAlertItem[];
  total: number;
}

export interface RiskForecastListParams {
  risk_status?: RiskStatus;
  skip?: number;
  limit?: number;
}

// Predictive Risk Alerts

export interface MilestoneBreachPrediction {
  milestone_id: string;
  milestone_title: string;
  due_date: string | null;
  days_until_breach: number;
  completion_pct: number;
  predicted_completion_pct_at_due: number;
  risk_level: "warning" | "critical";
}

export interface PredictiveRiskAlert {
  program_id: string;
  program_title: string;
  client_id: string;
  client_name: string;
  risk_score: number;
  risk_status: RiskStatus;
  task_velocity: number;
  tasks_remaining: number;
  milestone_predictions: MilestoneBreachPrediction[];
  earliest_breach_days: number | null;
  updated_at: string;
}

export interface PredictiveRiskListResponse {
  alerts: PredictiveRiskAlert[];
  total: number;
  warning_count: number;
  critical_count: number;
}
