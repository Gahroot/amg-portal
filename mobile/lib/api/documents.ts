import api from '@/lib/api';
import type { Document, DocumentListResponse } from '@/types/document';

export async function listDocuments(params?: { entity_type?: string; entity_id?: string; category?: string; skip?: number; limit?: number }): Promise<DocumentListResponse> {
  const res = await api.get<DocumentListResponse>('/documents', { params });
  return res.data;
}

export async function getDocument(id: string): Promise<Document> {
  const res = await api.get<Document>(`/documents/${id}`);
  return res.data;
}

export async function uploadDocument(formData: FormData): Promise<Document> {
  const res = await api.post<Document>('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function getDocumentDownloadUrl(id: string): Promise<string> {
  const res = await api.get<{ url: string }>(`/documents/${id}/download`);
  return res.data.url;
}
