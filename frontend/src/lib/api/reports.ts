import api from "@/lib/api";

// ============================================================================
// Types
// ============================================================================

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
// API Functions
// ============================================================================

export async function getPortfolioOverview(): Promise<PortfolioOverviewReport> {
  const response = await api.get<PortfolioOverviewReport>("/api/v1/reports/portfolio");
  return response.data;
}

export async function exportPortfolioOverview(): Promise<void> {
  const response = await api.get("/api/v1/reports/portfolio/export", {
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `portfolio_overview_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function getProgramStatusReport(programId: string): Promise<ProgramStatusReport> {
  const response = await api.get<ProgramStatusReport>("/api/v1/reports/program-status", {
    params: { program_id: programId },
  });
  return response.data;
}

export async function exportProgramStatusReport(programId: string): Promise<void> {
  const response = await api.get("/api/v1/reports/program-status/export", {
    params: { program_id: programId },
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `program_status_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function getCompletionReport(programId: string): Promise<CompletionReport> {
  const response = await api.get<CompletionReport>(`/api/v1/reports/completion/${programId}`);
  return response.data;
}

export async function exportCompletionReport(programId: string): Promise<void> {
  const response = await api.get(`/api/v1/reports/completion/${programId}/export`, {
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `completion_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function getAnnualReview(year: number): Promise<AnnualReviewReport> {
  const response = await api.get<AnnualReviewReport>(`/api/v1/reports/annual/${year}`);
  return response.data;
}

export async function exportAnnualReview(year: number): Promise<void> {
  const response = await api.get(`/api/v1/reports/annual/${year}/export`, {
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `annual_review_${year}_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// ============================================================================
// PDF Download Helpers
// ============================================================================

function dateStr(): string {
  return new Date().toISOString().split("T")[0];
}

function downloadBlob(data: Blob, filename: string): void {
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadPortfolioPDF(): Promise<void> {
  const response = await api.get("/api/v1/reports/portfolio/pdf", {
    responseType: "blob",
  });
  downloadBlob(response.data, `portfolio_overview_${dateStr()}.pdf`);
}

export async function downloadProgramStatusPDF(programId: string): Promise<void> {
  const response = await api.get("/api/v1/reports/program-status/pdf", {
    params: { program_id: programId },
    responseType: "blob",
  });
  downloadBlob(response.data, `program_status_${dateStr()}.pdf`);
}

export async function downloadCompletionPDF(programId: string): Promise<void> {
  const response = await api.get(`/api/v1/reports/completion/${programId}/pdf`, {
    responseType: "blob",
  });
  downloadBlob(response.data, `completion_report_${dateStr()}.pdf`);
}

export async function downloadAnnualReviewPDF(year: number): Promise<void> {
  const response = await api.get(`/api/v1/reports/annual/${year}/pdf`, {
    responseType: "blob",
  });
  downloadBlob(response.data, `annual_review_${year}_${dateStr()}.pdf`);
}
