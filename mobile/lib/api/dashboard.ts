import api from '@/lib/api';

export interface ProgramHealthItem {
  id: string;
  title: string;
  status: string;
  client_name: string;
  rag_status: 'red' | 'amber' | 'green';
  milestone_count: number;
  completed_milestone_count: number;
  milestone_progress: number;
  active_escalation_count: number;
  sla_breach_count: number;
}

export interface ProgramHealthResponse {
  programs: ProgramHealthItem[];
  total: number;
}

export interface PortfolioSummary {
  total_programs: number;
  active_programs: number;
  completed_programs: number;
  total_clients: number;
  rag_breakdown: Record<string, number>;
  total_open_escalations: number;
  total_sla_breaches: number;
  total_pending_decisions: number;
}

export async function getProgramHealth(): Promise<ProgramHealthResponse> {
  const res = await api.get<ProgramHealthResponse>('/dashboard/program-health');
  return res.data;
}

export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const res = await api.get<PortfolioSummary>('/dashboard/portfolio-summary');
  return res.data;
}

export async function getAtRiskPrograms(): Promise<ProgramHealthResponse> {
  const res = await api.get<ProgramHealthResponse>('/dashboard/at-risk-programs');
  return res.data;
}
