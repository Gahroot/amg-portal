import api from '@/lib/api';
import type { PortfolioOverviewReport, ProgramStatusReport, CompletionReport, AnnualReviewReport } from '@/types/report';

export async function getPortfolioOverview(clientId: string): Promise<PortfolioOverviewReport> {
  const res = await api.get<PortfolioOverviewReport>(`/reports/portfolio/${clientId}`);
  return res.data;
}

export async function getProgramStatusReport(programId: string): Promise<ProgramStatusReport> {
  const res = await api.get<ProgramStatusReport>(`/reports/program-status/${programId}`);
  return res.data;
}

export async function getCompletionReport(programId: string): Promise<CompletionReport> {
  const res = await api.get<CompletionReport>(`/reports/completion/${programId}`);
  return res.data;
}

export async function getAnnualReview(clientId: string, year: number): Promise<AnnualReviewReport> {
  const res = await api.get<AnnualReviewReport>(`/reports/annual-review/${clientId}`, { params: { year } });
  return res.data;
}
