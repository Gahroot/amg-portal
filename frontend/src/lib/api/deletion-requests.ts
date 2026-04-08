import api from "@/lib/api";
import type {
  DeletionRequest,
  DeletionRequestCreate,
  DeletionRequestListResponse,
  DeletionRequestListParams,
  RejectDeletionRequest,
} from "@/types/deletion-request";
import { createApiClient } from "./factory";

export type {
  DeletionRequest,
  DeletionRequestCreate,
  DeletionRequestListResponse,
  DeletionRequestListParams,
  RejectDeletionRequest,
};

const deletionApi = createApiClient<
  DeletionRequest,
  DeletionRequestListResponse,
  DeletionRequestCreate
>("/api/v1/deletion-requests/");

export const listDeletionRequests = deletionApi.list as (
  params?: DeletionRequestListParams,
) => Promise<DeletionRequestListResponse>;
export const getDeletionRequest = deletionApi.get;
export const createDeletionRequest = deletionApi.create;

// Custom endpoints

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
