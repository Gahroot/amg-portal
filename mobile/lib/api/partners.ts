import api from '@/lib/api';
import type { Partner, PartnerListResponse, AssignmentListResponse } from '@/types/partner';

export async function listPartners(params?: { status?: string; capability?: string; skip?: number; limit?: number }): Promise<PartnerListResponse> {
  const res = await api.get<PartnerListResponse>('/partners', { params });
  return res.data;
}

export async function getPartner(id: string): Promise<Partner> {
  const res = await api.get<Partner>(`/partners/${id}`);
  return res.data;
}

export async function listAssignments(params?: { partner_id?: string; program_id?: string; status?: string; skip?: number; limit?: number }): Promise<AssignmentListResponse> {
  const res = await api.get<AssignmentListResponse>('/partner-assignments', { params });
  return res.data;
}
