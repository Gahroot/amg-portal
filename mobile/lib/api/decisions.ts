import api from '@/lib/api';
import type { DecisionRequest, DecisionListResponse, DecisionResponseData } from '@/types/decision';

export async function listDecisions(params?: { client_id?: string; status?: string; skip?: number; limit?: number }): Promise<DecisionListResponse> {
  const res = await api.get<DecisionListResponse>('/decisions', { params });
  return res.data;
}

export async function getDecision(id: string): Promise<DecisionRequest> {
  const res = await api.get<DecisionRequest>(`/decisions/${id}`);
  return res.data;
}

export async function respondToDecision(id: string, data: DecisionResponseData): Promise<DecisionRequest> {
  const res = await api.post<DecisionRequest>(`/decisions/${id}/respond`, data);
  return res.data;
}
