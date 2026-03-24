export type RAGStatus = "green" | "amber" | "red";

export interface ReportMilestone {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  position: number;
}

export interface ReportDeliverable {
  id: string;
  title: string;
  deliverable_type: string;
  description: string | null;
  due_date: string | null;
  status: string;
  client_visible: boolean;
  submitted_at: string | null;
  reviewed_at: string | null;
}

export interface ReportPartner {
  id: string;
  firm_name: string;
  contact_name: string;
  contact_email: string;
}

export interface ReportPendingDecision {
  id: string;
  title: string;
  description: string | null;
  requested_at: string;
  deadline: string | null;
}

export interface PortfolioProgramSummary {
  id: string;
  title: string;
  status: string;
  rag_status: RAGStatus;
  start_date: string | null;
  end_date: string | null;
  budget_envelope: number | null;
  milestone_count: number;
  completed_milestone_count: number;
  milestone_progress: number;
}

export interface PortfolioOverviewReport {
  client_id: string;
  client_name: string;
  total_programs: number;
  active_programs: number;
  completed_programs: number;
  total_budget: number | null;
  status_breakdown: Record<string, number>;
  rag_summary: Record<string, number>;
  overall_milestone_progress: number;
  programs: PortfolioProgramSummary[];
  generated_at: string;
}

export interface ProgramStatusReport {
  program_id: string;
  program_title: string;
  program_status: string;
  rag_status: RAGStatus;
  start_date: string | null;
  end_date: string | null;
  milestone_progress: number;
  active_milestones: ReportMilestone[];
  completed_deliverables: ReportDeliverable[];
  pending_decisions: ReportPendingDecision[];
  assigned_partners: ReportPartner[];
  generated_at: string;
}

export interface CompletionMilestoneTimeline {
  id: string;
  title: string;
  planned_due_date: string | null;
  actual_completed_at: string | null;
  status: string;
  on_time: boolean | null;
}

export interface CompletionReport {
  program_id: string;
  program_title: string;
  client_id: string;
  client_name: string;
  objectives: string | null;
  scope: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  timeline_adherence: string | null;
  planned_budget: number | null;
  actual_budget: number | null;
  total_milestones: number;
  completed_milestones: number;
  milestone_timeline: CompletionMilestoneTimeline[];
  total_deliverables: number;
  approved_deliverables: number;
  deliverables: ReportDeliverable[];
  partners: ReportPartner[];
  generated_at: string;
}

export interface MonthlyProgramCount {
  month: number;
  month_name: string;
  new_programs: number;
  completed_programs: number;
}

export interface PartnerPerformanceSummary {
  partner_id: string;
  firm_name: string;
  total_assignments: number;
  completed_assignments: number;
  avg_performance_rating: number | null;
}

export interface AnnualProgramSummary {
  id: string;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  budget_envelope: number | null;
  rag_status: RAGStatus;
}

export interface AnnualReviewReport {
  client_id: string;
  client_name: string;
  year: number;
  total_programs: number;
  new_programs: number;
  completed_programs: number;
  active_programs: number;
  total_engagement_value: number | null;
  total_budget_consumed: number | null;
  programs_by_status: Record<string, number>;
  programs_by_month: MonthlyProgramCount[];
  partner_performance: PartnerPerformanceSummary[];
  programs: AnnualProgramSummary[];
  generated_at: string;
}

// ============================================================================
// Partner Reports (Class C) — partner-facing, scoped to own data only
// ============================================================================

export interface PartnerBriefSummaryItem {
  assignment_id: string;
  assignment_title: string;
  status: string;
  brief: string | null;
  sla_terms: string | null;
  due_date: string | null;
  accepted_at: string | null;
  program_title: string | null;
  coordinator_name: string | null;
  coordinator_email: string | null;
}

export interface PartnerBriefSummaryReport {
  partner_id: string;
  firm_name: string;
  total_active: number;
  assignments: PartnerBriefSummaryItem[];
  generated_at: string;
}

export interface PartnerDeliverableFeedbackItem {
  deliverable_id: string;
  title: string;
  deliverable_type: string;
  assignment_id: string;
  assignment_title: string | null;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_comments: string | null;
  due_date: string | null;
}

export interface PartnerDeliverableFeedbackReport {
  partner_id: string;
  firm_name: string;
  total_deliverables: number;
  deliverables: PartnerDeliverableFeedbackItem[];
  generated_at: string;
}

export interface PartnerEngagementHistoryItem {
  assignment_id: string;
  title: string;
  program_title: string | null;
  status: string;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  due_date: string | null;
  deliverable_count: number;
  approved_deliverable_count: number;
}

export interface PartnerEngagementHistoryReport {
  partner_id: string;
  firm_name: string;
  total_engagements: number;
  completed_engagements: number;
  performance_rating: number | null;
  assignments: PartnerEngagementHistoryItem[];
  generated_at: string;
}

// ============================================================================
// RM Portfolio Report (Class B — internal, MD review)
// ============================================================================

export interface RMClientProgramSummary {
  id: string;
  title: string;
  status: string;
  rag_status: RAGStatus;
  start_date: string | null;
  end_date: string | null;
  budget_envelope: number | null;
  milestone_count: number;
  completed_milestone_count: number;
  milestone_progress: number;
}

export interface RMClientSummary {
  client_id: string;
  client_name: string;
  client_type: string;
  client_status: string;
  total_programs: number;
  active_programs: number;
  completed_programs: number;
  status_breakdown: Record<string, number>;
  rag_summary: Record<string, number>;
  milestone_completion_rate: number | null;
  revenue_pipeline: number | null;
  programs: RMClientProgramSummary[];
}

export interface RMPortfolioReport {
  rm_id: string;
  rm_name: string;
  rm_email: string;
  total_clients: number;
  total_active_programs: number;
  total_revenue_pipeline: number | null;
  avg_nps_score: number | null;
  clients: RMClientSummary[];
  generated_at: string;
}

// ============================================================================
// Escalation Log Report (Class B — internal operational)
// ============================================================================

export interface EscalationLogItem {
  id: string;
  title: string;
  description: string | null;
  level: string;
  status: string;
  entity_type: string;
  entity_id: string;
  program_id: string | null;
  client_id: string | null;
  owner_id: string;
  owner_name: string | null;
  owner_email: string | null;
  triggered_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  age_days: number;
  resolution_time_days: number | null;
  resolution_notes: string | null;
}

export interface EscalationLogReport {
  total_escalations: number;
  open_escalations: number;
  avg_resolution_time_days: number | null;
  escalations: EscalationLogItem[];
  generated_at: string;
}

// ============================================================================
// Compliance Audit Report (Class B — internal operational)
// ============================================================================

export interface ClientKYCStatus {
  client_id: string;
  client_name: string;
  client_type: string;
  total_documents: number;
  current: number;
  expiring_30d: number;
  expired: number;
  pending: number;
  document_completeness_pct: number;
  kyc_status: "current" | "expiring" | "expired" | "pending" | "incomplete";
}

export interface AccessAnomalySummary {
  id: string;
  audit_period: string;
  finding_type: string;
  severity: string;
  description: string;
  status: string;
  user_id: string | null;
}

export interface UserAccountStatus {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

export interface ComplianceAuditReport {
  total_clients: number;
  kyc_current: number;
  kyc_expiring_30d: number;
  kyc_expired: number;
  client_kyc_statuses: ClientKYCStatus[];
  access_anomalies: AccessAnomalySummary[];
  latest_audit_period: string | null;
  total_users: number;
  active_users: number;
  inactive_users: number;
  deactivated_users: number;
  user_account_statuses: UserAccountStatus[];
  generated_at: string;
}
