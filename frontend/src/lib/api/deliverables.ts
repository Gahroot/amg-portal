import api from "@/lib/api";
import type {
  DeliverableItem,
  DeliverableListResponse,
  DeliverableListParams,
  DeliverableCreateData,
  DeliverableUpdateData,
  DeliverableReviewData,
} from "@/types/deliverable";
import { createApiClient } from "./factory";

// Re-export types for convenience
export type {
  DeliverableItem,
  DeliverableListResponse,
  DeliverableListParams,
  DeliverableCreateData,
  DeliverableUpdateData,
  DeliverableReviewData,
};

const deliverablesApi = createApiClient<
  DeliverableItem,
  DeliverableListResponse,
  DeliverableCreateData,
  DeliverableUpdateData
>("/api/v1/deliverables/");

export const listDeliverables = deliverablesApi.list as (
  params?: DeliverableListParams,
) => Promise<DeliverableListResponse>;
export const getDeliverable = deliverablesApi.get;
export const createDeliverable = deliverablesApi.create;
export const updateDeliverable = deliverablesApi.update;

// Custom endpoints

export async function submitDeliverable(id: string, file: File): Promise<DeliverableItem> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<DeliverableItem>(`/api/v1/deliverables/${id}/submit`, formData);
  return response.data;
}

export async function reviewDeliverable(id: string, data: DeliverableReviewData): Promise<DeliverableItem> {
  const response = await api.post<DeliverableItem>(`/api/v1/deliverables/${id}/review`, data);
  return response.data;
}

export async function uploadDeliverableFile(id: string, file: File): Promise<DeliverableItem> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<DeliverableItem>(`/api/v1/deliverables/${id}/upload`, formData);
  return response.data;
}

export async function attachDocumentToDeliverable(id: string, documentId: string): Promise<DeliverableItem> {
  const response = await api.post<DeliverableItem>(`/api/v1/deliverables/${id}/attach-document`, {
    document_id: documentId,
  });
  return response.data;
}

export async function getDownloadUrl(id: string): Promise<{ download_url: string }> {
  const response = await api.get<{ download_url: string }>(`/api/v1/deliverables/${id}/download`);
  return response.data;
}
