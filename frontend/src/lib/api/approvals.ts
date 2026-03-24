import api from "@/lib/api";
import type {
  Approval,
  ApprovalCommentCreate,
  ApprovalCommentThread,
  ApprovalDecision,
  ApprovalListParams,
  ApprovalRequest,
} from "@/types/approval";

// Re-export types for convenience
export type {
  Approval,
  ApprovalCommentCreate,
  ApprovalCommentThread,
  ApprovalDecision,
  ApprovalListParams,
  ApprovalRequest,
};

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

// ─── Comment API ─────────────────────────────────────────────────────────────

export async function getApprovalComments(
  entityId: string,
  entityType: string = "program_approval",
  includeInternal: boolean = true
): Promise<ApprovalCommentThread> {
  const response = await api.get<ApprovalCommentThread>(
    `/api/v1/approvals/${entityId}/comments`,
    { params: { entity_type: entityType, include_internal: includeInternal } }
  );
  return response.data;
}

export async function addApprovalComment(
  entityId: string,
  data: ApprovalCommentCreate,
  entityType: string = "program_approval"
): Promise<ApprovalCommentThread["comments"][0]> {
  const response = await api.post<ApprovalCommentThread["comments"][0]>(
    `/api/v1/approvals/${entityId}/comments`,
    data,
    { params: { entity_type: entityType } }
  );
  return response.data;
}

export async function deleteApprovalComment(
  entityId: string,
  commentId: string,
  entityType: string = "program_approval"
): Promise<void> {
  await api.delete(
    `/api/v1/approvals/${entityId}/comments/${commentId}`,
    { params: { entity_type: entityType } }
  );
}
