import api from "@/lib/api";
import type {
  DeliverableItem,
  DeliverableListResponse,
  DeliverableListParams,
  DeliverableCreateData,
  DeliverableUpdateData,
  DeliverableReviewData,
} from "@/types/deliverable";

// Re-export types for convenience
export type {
  DeliverableItem,
  DeliverableListResponse,
  DeliverableListParams,
  DeliverableCreateData,
  DeliverableUpdateData,
  DeliverableReviewData,
};

export async function listDeliverables(params?: DeliverableListParams): Promise<DeliverableListResponse> {
  const response = await api.get<DeliverableListResponse>("/api/v1/deliverables/", { params });
  return response.data;
}

export async function getDeliverable(id: string): Promise<DeliverableItem> {
  const response = await api.get<DeliverableItem>(`/api/v1/deliverables/${id}`);
  return response.data;
}

export async function createDeliverable(data: DeliverableCreateData): Promise<DeliverableItem> {
  const response = await api.post<DeliverableItem>("/api/v1/deliverables/", data);
  return response.data;
}

export async function updateDeliverable(id: string, data: DeliverableUpdateData): Promise<DeliverableItem> {
  const response = await api.patch<DeliverableItem>(`/api/v1/deliverables/${id}`, data);
  return response.data;
}

export async function submitDeliverable(id: string, file: File): Promise<DeliverableItem> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<DeliverableItem>(`/api/v1/deliverables/${id}/submit`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function reviewDeliverable(id: string, data: DeliverableReviewData): Promise<DeliverableItem> {
  const response = await api.post<DeliverableItem>(`/api/v1/deliverables/${id}/review`, data);
  return response.data;
}

export async function getDownloadUrl(id: string): Promise<{ download_url: string }> {
  const response = await api.get<{ download_url: string }>(`/api/v1/deliverables/${id}/download`);
  return response.data;
}
