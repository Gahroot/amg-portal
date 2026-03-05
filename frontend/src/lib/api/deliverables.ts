import api from "@/lib/api";

export interface DeliverableItem {
  id: string;
  assignment_id: string;
  title: string;
  deliverable_type: string;
  description: string | null;
  due_date: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  submitted_at: string | null;
  submitted_by: string | null;
  status: string;
  review_comments: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  client_visible: boolean;
  created_at: string;
  updated_at: string;
  download_url: string | null;
}

export interface DeliverableListResponse {
  deliverables: DeliverableItem[];
  total: number;
}

export interface DeliverableListParams {
  skip?: number;
  limit?: number;
  assignment_id?: string;
  status?: string;
}

export interface DeliverableCreateData {
  assignment_id: string;
  title: string;
  deliverable_type?: string;
  description?: string;
  due_date?: string;
}

export interface DeliverableUpdateData {
  title?: string;
  description?: string;
  due_date?: string;
  client_visible?: boolean;
}

export interface DeliverableReviewData {
  status: "approved" | "returned" | "rejected";
  review_comments?: string;
}

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
