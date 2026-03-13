import api from "@/lib/api";
import type {
  DeletionRequest,
  DeletionRequestListResponse,
  DeletionRequestCreateData,
  DeletionRequestRejectData,
} from "@/types/deletion-request";

export interface DeletionRequestListParams {
  status?: string;
  entity_type?: string;
  skip?: number;
  limit?: number;
}

export async function listDeletionRequests(
  params?: DeletionRequestListParams
): Promise<DeletionRequestListResponse> {
  const response = await api.get<DeletionRequestListResponse>(
    "/api/v1/deletion-requests/",
    { params }
  );
  return response.data;
}

export async function getDeletionRequest(
  id: string
): Promise<DeletionRequest> {
  const response = await api.get<DeletionRequest>(
    `/api/v1/deletion-requests/${id}`
  );
  return response.data;
}

export async function createDeletionRequest(
  data: DeletionRequestCreateData
): Promise<DeletionRequest> {
  const response = await api.post<DeletionRequest>(
    "/api/v1/deletion-requests/",
    data
  );
  return response.data;
}

export async function approveDeletionRequest(
  id: string
): Promise<DeletionRequest> {
  const response = await api.post<DeletionRequest>(
    `/api/v1/deletion-requests/${id}/approve`,
    {}
  );
  return response.data;
}

export async function rejectDeletionRequest(
  id: string,
  data: DeletionRequestRejectData
): Promise<DeletionRequest> {
  const response = await api.post<DeletionRequest>(
    `/api/v1/deletion-requests/${id}/reject`,
    data
  );
  return response.data;
}
