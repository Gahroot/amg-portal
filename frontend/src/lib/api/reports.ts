import api from "@/lib/api";
import type {
  RAGStatus,
  ReportMilestone,
  ReportDeliverable,
  ReportPartner,
  ReportPendingDecision,
  PortfolioProgramSummary,
  PortfolioOverviewReport,
  ProgramStatusReport,
  CompletionMilestoneTimeline,
  CompletionReport,
  MonthlyProgramCount,
  PartnerPerformanceSummary,
  AnnualProgramSummary,
  AnnualReviewReport,
  RMClientProgramSummary,
  RMClientSummary,
  RMPortfolioReport,
  EscalationLogItem,
  EscalationLogReport,
  ClientKYCStatus,
  AccessAnomalySummary,
  UserAccountStatus,
  ComplianceAuditReport,
} from "@/types/report";

export type {
  RAGStatus,
  ReportMilestone,
  ReportDeliverable,
  ReportPartner,
  ReportPendingDecision,
  PortfolioProgramSummary,
  PortfolioOverviewReport,
  ProgramStatusReport,
  CompletionMilestoneTimeline,
  CompletionReport,
  MonthlyProgramCount,
  PartnerPerformanceSummary,
  AnnualProgramSummary,
  AnnualReviewReport,
  RMClientProgramSummary,
  RMClientSummary,
  RMPortfolioReport,
  EscalationLogItem,
  EscalationLogReport,
  ClientKYCStatus,
  AccessAnomalySummary,
  UserAccountStatus,
  ComplianceAuditReport,
};

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
// Portal Program Status APIs (client-scoped, via /portal endpoints)
// ============================================================================

export async function getPortalProgramStatuses(): Promise<ProgramStatusReport[]> {
  const response = await api.get<ProgramStatusReport[]>("/api/v1/portal/program-status");
  return response.data;
}

export async function getPortalProgramStatus(programId: string): Promise<ProgramStatusReport> {
  const response = await api.get<ProgramStatusReport>(
    `/api/v1/portal/program-status/${programId}`,
  );
  return response.data;
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

// ============================================================================
// Class B — Internal Operational Report APIs
// ============================================================================

export interface EscalationLogParams {
  program_id?: string;
  client_id?: string;
  level?: string;
  status?: string;
}

export async function getRMPortfolioReport(rmId?: string): Promise<RMPortfolioReport> {
  const params = rmId ? { rm_id: rmId } : undefined;
  const response = await api.get<RMPortfolioReport>("/api/v1/reports/rm-portfolio", { params });
  return response.data;
}

export async function getEscalationLogReport(
  params?: EscalationLogParams,
): Promise<EscalationLogReport> {
  const response = await api.get<EscalationLogReport>("/api/v1/reports/escalation-log", {
    params,
  });
  return response.data;
}

export async function getComplianceAuditReport(): Promise<ComplianceAuditReport> {
  const response = await api.get<ComplianceAuditReport>("/api/v1/reports/compliance");
  return response.data;
}

// ============================================================================
// Report Favorites APIs
// ============================================================================

export interface ReportFavoritesResponse {
  favorites: string[];
}

export async function getReportFavorites(): Promise<ReportFavoritesResponse> {
  const response = await api.get<ReportFavoritesResponse>("/api/v1/reports/favorites");
  return response.data;
}

export async function addReportFavorite(reportType: string): Promise<ReportFavoritesResponse> {
  const response = await api.post<ReportFavoritesResponse>(
    `/api/v1/reports/favorites/${reportType}`,
  );
  return response.data;
}

export async function removeReportFavorite(reportType: string): Promise<ReportFavoritesResponse> {
  const response = await api.delete<ReportFavoritesResponse>(
    `/api/v1/reports/favorites/${reportType}`,
  );
  return response.data;
}
