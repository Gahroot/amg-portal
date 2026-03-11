import api from '@/lib/api';
import type { Escalation, EscalationListResponse, EscalationListParams } from '@/types/escalation';

export async function listEscalations(params?: EscalationListParams): Promise<EscalationListResponse> {
  const res = await api.get<EscalationListResponse>('/escalations', { params });
  return res.data;
}

export async function getEscalation(id: string): Promise<Escalation> {
  const res = await api.get<Escalation>(`/escalations/${id}`);
  return res.data;
}
