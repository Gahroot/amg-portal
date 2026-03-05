import api from "@/lib/api";

export interface Approval {
  id: string;
  program_id: string;
  approval_type: string;
  requested_by: string;
  requester_name: string;
  approved_by: string | null;
  approver_name: string | null;
  status: "pending" | "approved" | "rejected";
  comments: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRequest {
  program_id: string;
  approval_type: "standard" | "elevated" | "strategic" | "emergency";
  comments?: string;
}

export interface ApprovalDecision {
  status: "approved" | "rejected";
  comments?: string;
}

export interface ApprovalListParams {
  skip?: number;
  limit?: number;
}

export async function listApprovals(
  params?: ApprovalListParams
): Promise<Approval[]> {
  const response = await api.get<Approval[]>("/api/v1/approvals/", {
    params,
  });
  return response.data;
}

export async function requestApproval(
  data: ApprovalRequest
): Promise<Approval> {
  const response = await api.post<Approval>("/api/v1/approvals/", data);
  return response.data;
}

export async function decideApproval(
  id: string,
  data: ApprovalDecision
): Promise<Approval> {
  const response = await api.patch<Approval>(
    `/api/v1/approvals/${id}`,
    data
  );
  return response.data;
}

export async function getProgramApprovals(
  programId: string
): Promise<Approval[]> {
  const response = await api.get<Approval[]>(
    `/api/v1/approvals/program/${programId}`
  );
  return response.data;
}
