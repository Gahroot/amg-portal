import api from "@/lib/api";
import type {
  BudgetApprovalRequest,
  BudgetApprovalListParams,
  BudgetApprovalStepDecision,
  PaginatedBudgetApprovalRequests,
  PendingApprovalsResponse,
  BudgetApprovalStepResponse,
  BudgetApprovalHistoryEntry,
  ApprovalThreshold,
  ApprovalThresholdCreate,
  ApprovalThresholdUpdate,
  ApprovalChain,
  ApprovalChainSummary,
  ApprovalChainCreate,
  ApprovalChainUpdate,
  ApprovalChainStep,
  ApprovalChainStepCreate,
} from "@/types/budget-approval";

export type {
  BudgetApprovalRequest,
  BudgetApprovalListParams,
  BudgetApprovalStepDecision,
  PaginatedBudgetApprovalRequests,
  PendingApprovalsResponse,
  BudgetApprovalStepResponse,
  BudgetApprovalHistoryEntry,
  ApprovalThreshold,
  ApprovalThresholdCreate,
  ApprovalThresholdUpdate,
  ApprovalChain,
  ApprovalChainSummary,
  ApprovalChainCreate,
  ApprovalChainUpdate,
  ApprovalChainStep,
  ApprovalChainStepCreate,
};

const BASE = "/api/v1/budget-approvals";

export async function listBudgetApprovalRequests(
  params?: BudgetApprovalListParams
): Promise<PaginatedBudgetApprovalRequests> {
  const response = await api.get<PaginatedBudgetApprovalRequests>(
    `${BASE}/requests`,
    { params }
  );
  return response.data;
}

export async function getPendingBudgetApprovals(): Promise<PendingApprovalsResponse> {
  const response = await api.get<PendingApprovalsResponse>(
    `${BASE}/requests/pending`
  );
  return response.data;
}

export async function getBudgetApprovalRequest(
  id: string
): Promise<BudgetApprovalRequest> {
  const response = await api.get<BudgetApprovalRequest>(
    `${BASE}/requests/${id}`
  );
  return response.data;
}

export async function cancelBudgetApprovalRequest(
  id: string,
  reason?: string
): Promise<BudgetApprovalRequest> {
  const response = await api.post<BudgetApprovalRequest>(
    `${BASE}/requests/${id}/cancel`,
    null,
    { params: reason ? { reason } : undefined }
  );
  return response.data;
}

export async function decideBudgetApprovalStep(
  stepId: string,
  data: BudgetApprovalStepDecision
): Promise<BudgetApprovalStepResponse> {
  const response = await api.post<BudgetApprovalStepResponse>(
    `${BASE}/steps/${stepId}/decide`,
    data
  );
  return response.data;
}

export async function getBudgetApprovalHistory(
  requestId: string
): Promise<BudgetApprovalHistoryEntry[]> {
  const response = await api.get<BudgetApprovalHistoryEntry[]>(
    `${BASE}/requests/${requestId}/history`
  );
  return response.data;
}

// === Approval Threshold API ===

export async function listApprovalThresholds(
  isActive?: boolean
): Promise<ApprovalThreshold[]> {
  const response = await api.get<ApprovalThreshold[]>(`${BASE}/thresholds`, {
    params: isActive !== undefined ? { is_active: isActive } : undefined,
  });
  return response.data;
}

export async function createApprovalThreshold(
  data: ApprovalThresholdCreate
): Promise<ApprovalThreshold> {
  const response = await api.post<ApprovalThreshold>(
    `${BASE}/thresholds`,
    data
  );
  return response.data;
}

export async function updateApprovalThreshold(
  id: string,
  data: ApprovalThresholdUpdate
): Promise<ApprovalThreshold> {
  const response = await api.patch<ApprovalThreshold>(
    `${BASE}/thresholds/${id}`,
    data
  );
  return response.data;
}

export async function deleteApprovalThreshold(id: string): Promise<void> {
  await api.delete(`${BASE}/thresholds/${id}`);
}

// === Approval Chain API ===

export async function listApprovalChains(
  isActive?: boolean
): Promise<ApprovalChainSummary[]> {
  const response = await api.get<ApprovalChainSummary[]>(`${BASE}/chains`, {
    params: isActive !== undefined ? { is_active: isActive } : undefined,
  });
  return response.data;
}

export async function getApprovalChain(id: string): Promise<ApprovalChain> {
  const response = await api.get<ApprovalChain>(`${BASE}/chains/${id}`);
  return response.data;
}

export async function createApprovalChain(
  data: ApprovalChainCreate
): Promise<ApprovalChain> {
  const response = await api.post<ApprovalChain>(`${BASE}/chains`, data);
  return response.data;
}

export async function updateApprovalChain(
  id: string,
  data: ApprovalChainUpdate
): Promise<ApprovalChain> {
  const response = await api.patch<ApprovalChain>(
    `${BASE}/chains/${id}`,
    data
  );
  return response.data;
}

export async function deleteApprovalChain(id: string): Promise<void> {
  await api.delete(`${BASE}/chains/${id}`);
}

export async function addChainStep(
  chainId: string,
  data: ApprovalChainStepCreate
): Promise<ApprovalChainStep> {
  const response = await api.post<ApprovalChainStep>(
    `${BASE}/chains/${chainId}/steps`,
    data
  );
  return response.data;
}

export async function removeChainStep(
  chainId: string,
  stepId: string
): Promise<void> {
  await api.delete(`${BASE}/chains/${chainId}/steps/${stepId}`);
}
