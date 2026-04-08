/**
 * Report types — re-exported from generated OpenAPI types where possible.
 *
 * API types are sourced from generated.ts (auto-generated from FastAPI OpenAPI schema).
 * Frontend-only types (display helpers) remain manual.
 *
 * To refresh: npm run generate:types (requires backend at localhost:8000)
 *
 * @see backend/app/schemas/report.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type ProgramStatusReport = components["schemas"]["ProgramStatusReport"];
export type AnnualProgramSummary = components["schemas"]["AnnualProgramSummary"];
export type AnnualReviewReport = components["schemas"]["AnnualReviewReport"];
export type PartnerBriefSummaryItem = components["schemas"]["PartnerBriefSummaryItem"];
export type PartnerBriefSummaryReport = components["schemas"]["PartnerBriefSummaryReport"];
export type PartnerDeliverableFeedbackItem = components["schemas"]["PartnerDeliverableFeedbackItem"];
export type PartnerDeliverableFeedbackReport = components["schemas"]["PartnerDeliverableFeedbackReport"];
export type PartnerEngagementHistoryItem = components["schemas"]["PartnerEngagementHistoryItem"];
export type PartnerEngagementHistoryReport = components["schemas"]["PartnerEngagementHistoryReport"];
export type EscalationLogItem = components["schemas"]["EscalationLogItem"];
export type EscalationLogReport = components["schemas"]["EscalationLogReport"];
export type ClientKYCStatus = components["schemas"]["ClientKYCStatus"];
export type AccessAnomalySummary = components["schemas"]["AccessAnomalySummary"];
export type UserAccountStatus = components["schemas"]["UserAccountStatus"];

// ---------------------------------------------------------------------------
// Frontend-only types — display helpers, report sub-types
// ---------------------------------------------------------------------------

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

// RM Portfolio Report

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

// Compliance Audit Report

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
