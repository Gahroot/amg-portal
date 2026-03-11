export interface PortfolioProgramSummary {
  id: string;
  title: string;
  status: string;
  rag_status: string;
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

export interface ProgramStatusReport {
  program_id: string;
  program_title: string;
  program_status: string;
  rag_status: string;
  start_date: string | null;
  end_date: string | null;
  milestone_progress: number;
  active_milestones: ReportMilestone[];
  completed_deliverables: ReportDeliverable[];
  pending_decisions: { id: string; title: string; description: string | null; requested_at: string; deadline: string | null }[];
  assigned_partners: { id: string; firm_name: string; contact_name: string; contact_email: string }[];
  generated_at: string;
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
  total_deliverables: number;
  approved_deliverables: number;
  deliverables: ReportDeliverable[];
  generated_at: string;
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
  generated_at: string;
}
