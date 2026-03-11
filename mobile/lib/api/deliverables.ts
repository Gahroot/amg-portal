import api from '@/lib/api';
import type { Deliverable, DeliverableListResponse, DeliverableReviewData } from '@/types/deliverable';

export async function listDeliverables(params?: { assignment_id?: string; status?: string; skip?: number; limit?: number }): Promise<DeliverableListResponse> {
  const res = await api.get<DeliverableListResponse>('/deliverables', { params });
  return res.data;
}

export async function getDeliverable(id: string): Promise<Deliverable> {
  const res = await api.get<Deliverable>(`/deliverables/${id}`);
  return res.data;
}

export async function submitDeliverable(id: string, formData: FormData): Promise<Deliverable> {
  const res = await api.post<Deliverable>(`/deliverables/${id}/submit`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function reviewDeliverable(id: string, data: DeliverableReviewData): Promise<Deliverable> {
  const res = await api.post<Deliverable>(`/deliverables/${id}/review`, data);
  return res.data;
}
