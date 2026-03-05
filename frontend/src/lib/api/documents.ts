import api from "@/lib/api";
import type { DocumentItem, DocumentListResponse } from "@/types/document";

export interface DocumentListParams {
  entity_type?: string;
  entity_id?: string;
  category?: string;
  skip?: number;
  limit?: number;
}

export async function uploadDocument(
  file: File,
  entityType: string,
  entityId: string,
  category?: string,
  description?: string,
): Promise<DocumentItem> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("entity_type", entityType);
  formData.append("entity_id", entityId);
  if (category) formData.append("category", category);
  if (description) formData.append("description", description);
  const response = await api.post<DocumentItem>("/api/v1/documents/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function listDocuments(params?: DocumentListParams): Promise<DocumentListResponse> {
  const response = await api.get<DocumentListResponse>("/api/v1/documents/", { params });
  return response.data;
}

export async function getDocument(id: string): Promise<DocumentItem> {
  const response = await api.get<DocumentItem>(`/api/v1/documents/${id}`);
  return response.data;
}

export async function getDocumentDownloadUrl(id: string): Promise<{ download_url: string }> {
  const response = await api.get<{ download_url: string }>(`/api/v1/documents/${id}/download`);
  return response.data;
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/api/v1/documents/${id}`);
}
