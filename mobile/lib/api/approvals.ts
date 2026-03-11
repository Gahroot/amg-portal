import api from '@/lib/api';
import type { Approval, ApprovalDecisionData } from '@/types/approval';

export interface ApprovalListResponse {
  approvals: Approval[];
  total: number;
}

export interface ApprovalListParams {
  approval_type?: string;
  status?: string;
  skip?: number;
  limit?: number;
}

export async function listApprovals(params?: ApprovalListParams): Promise<ApprovalListResponse> {
  const res = await api.get<ApprovalListResponse>('/approvals', { params });
  return res.data;
}

export async function getApproval(id: string): Promise<Approval> {
  const res = await api.get<Approval>(`/approvals/${id}`);
  return res.data;
}

export async function decideApproval(id: string, data: ApprovalDecisionData): Promise<Approval> {
  const res = await api.post<Approval>(`/approvals/${id}/decide`, data);
  return res.data;
}
