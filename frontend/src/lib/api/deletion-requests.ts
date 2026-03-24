import api from "@/lib/api";
import type {
  DeletionRequest,
  DeletionRequestCreate,
  DeletionRequestListResponse,
  DeletionRequestListParams,
  RejectDeletionRequest,
} from "@/types/deletion-request";

export type {
  DeletionRequest,
  DeletionRequestCreate,
  DeletionRequestListResponse,
  DeletionRequestListParams,
  RejectDeletionRequest,
};

export async function listDeletionRequests(
  params?: DeletionRequestListParams,
): Promise<DeletionRequestListResponse> {
  const response = await api.get<DeletionRequestListResponse>(
    "/api/v1/deletion-requests/",
    { params },
  );
  return response.data;
}

export async function getDeletionRequest(id: string): Promise<DeletionRequest> {
  const response = await api.get<DeletionRequest>(
    `/api/v1/deletion-requests/${id}`,
  );
  return response.data;
}

export async function createDeletionRequest(
  data: DeletionRequestCreate,
): Promise<DeletionRequest> {
  const response = await api.post<DeletionRequest>(
    "/api/v1/deletion-requests/",
    data,
  );
  return response.data;
}

export async function approveDeletionRequest(
  id: string,
): Promise<DeletionRequest> {
  const response = await api.post<DeletionRequest>(
    `/api/v1/deletion-requests/${id}/approve`,
  );
  return response.data;
}

export async function rejectDeletionRequest(
  id: string,
  data: RejectDeletionRequest,
): Promise<DeletionRequest> {
  const response = await api.post<DeletionRequest>(
    `/api/v1/deletion-requests/${id}/reject`,
    data,
  );
  return response.data;
}
