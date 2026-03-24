import api from "@/lib/api";
import type {
  DocumentCompareResponse,
  DocumentItem,
  DocumentListResponse,
  DocumentVersionListResponse,
  ExpiringDocumentsResponse,
  DocumentRequestCreate,
  DocumentRequestItem,
  DocumentRequestListResponse,
  DocumentRequestUpdate,
} from "@/types/document";
import type {
  DeliverDocumentRequest,
  DocumentDeliveryListResponse,
  SecureLinkRequest,
  SecureLinkResponse,
  SealDocumentRequest,
  CustodyChainResponse,
  VaultDocument,
  VaultDocumentListResponse,
} from "@/types/document-delivery";

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

export async function uploadDocumentWithProgress(
  file: File,
  entityType: string,
  entityId: string,
  category: string,
  description: string | undefined,
  onProgress: (percent: number) => void,
): Promise<DocumentItem> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("entity_type", entityType);
  formData.append("entity_id", entityId);
  formData.append("category", category);
  if (description) formData.append("description", description);

  const response = await api.post<DocumentItem>("/api/v1/documents/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (e.total) onProgress(Math.round((e.loaded * 100) / e.total));
    },
  });
  return response.data;
}

export async function bulkUploadDocuments(
  files: Array<{ file: File; category: string; description?: string }>,
  entityType: string,
  entityId: string,
  onFileProgress: (index: number, percent: number) => void,
): Promise<Array<{ index: number; result?: DocumentItem; error?: string }>> {
  const results: Array<{ index: number; result?: DocumentItem; error?: string }> = [];
  for (let i = 0; i < files.length; i++) {
    const { file, category, description } = files[i];
    try {
      const result = await uploadDocumentWithProgress(
        file,
        entityType,
        entityId,
        category,
        description,
        (percent) => onFileProgress(i, percent),
      );
      results.push({ index: i, result });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Upload failed";
      results.push({ index: i, error });
    }
  }
  return results;
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

export async function getDocumentVersions(id: string): Promise<DocumentVersionListResponse> {
  const response = await api.get<DocumentVersionListResponse>(`/api/v1/documents/${id}/versions`);
  return response.data;
}

export async function deliverDocument(
  documentId: string,
  data: DeliverDocumentRequest,
): Promise<DocumentDeliveryListResponse> {
  const response = await api.post<DocumentDeliveryListResponse>(
    `/api/v1/documents/${documentId}/deliver`,
    data,
  );
  return response.data;
}

export async function createSecureLink(
  documentId: string,
  data: SecureLinkRequest,
): Promise<SecureLinkResponse> {
  const response = await api.post<SecureLinkResponse>(
    `/api/v1/documents/${documentId}/secure-link`,
    data,
  );
  return response.data;
}

export async function sealDocument(
  documentId: string,
  data?: SealDocumentRequest,
): Promise<VaultDocument> {
  const response = await api.post<VaultDocument>(
    `/api/v1/documents/${documentId}/seal`,
    data || {},
  );
  return response.data;
}

export async function getCustodyChain(documentId: string): Promise<CustodyChainResponse> {
  const response = await api.get<CustodyChainResponse>(
    `/api/v1/documents/${documentId}/custody-chain`,
  );
  return response.data;
}

export async function getDocumentDeliveries(documentId: string): Promise<DocumentDeliveryListResponse> {
  const response = await api.get<DocumentDeliveryListResponse>(
    `/api/v1/documents/${documentId}/deliveries`,
  );
  return response.data;
}

export interface VaultListParams {
  vault_status?: string;
  skip?: number;
  limit?: number;
}

export async function listVaultDocuments(params?: VaultListParams): Promise<VaultDocumentListResponse> {
  const response = await api.get<VaultDocumentListResponse>("/api/v1/documents/vault", { params });
  return response.data;
}

export async function verifyDocumentIntegrity(documentId: string): Promise<{
  document_id: string;
  file_name: string;
  vault_status: string;
  integrity_ok: boolean;
  issues: string[];
  checked_at: string;
}> {
  const response = await api.get(`/api/v1/documents/${documentId}/integrity`);
  return response.data;
}

export interface ExpiringDocumentsParams {
  entity_type?: string;
  entity_id?: string;
  status?: "expired" | "expiring_30" | "expiring_90";
  skip?: number;
  limit?: number;
}

export async function listExpiringDocuments(
  params?: ExpiringDocumentsParams,
): Promise<ExpiringDocumentsResponse> {
  const response = await api.get<ExpiringDocumentsResponse>("/api/v1/documents/expiring", {
    params,
  });
  return response.data;
}

// ── Document Request API ──────────────────────────────────────────────────────

export async function createDocumentRequest(
  data: DocumentRequestCreate,
): Promise<DocumentRequestItem> {
  const response = await api.post<DocumentRequestItem>("/api/v1/document-requests/", data);
  return response.data;
}

export async function listDocumentRequests(params?: {
  client_id?: string;
  status?: string;
  skip?: number;
  limit?: number;
}): Promise<DocumentRequestListResponse> {
  const response = await api.get<DocumentRequestListResponse>("/api/v1/document-requests/", {
    params,
  });
  return response.data;
}

export async function getDocumentRequest(id: string): Promise<DocumentRequestItem> {
  const response = await api.get<DocumentRequestItem>(`/api/v1/document-requests/${id}`);
  return response.data;
}

export async function updateDocumentRequest(
  id: string,
  data: DocumentRequestUpdate,
): Promise<DocumentRequestItem> {
  const response = await api.patch<DocumentRequestItem>(`/api/v1/document-requests/${id}`, data);
  return response.data;
}

export async function cancelDocumentRequest(id: string): Promise<DocumentRequestItem> {
  const response = await api.post<DocumentRequestItem>(`/api/v1/document-requests/${id}/cancel`);
  return response.data;
}

export async function sendDocumentRequestReminder(id: string): Promise<DocumentRequestItem> {
  const response = await api.post<DocumentRequestItem>(`/api/v1/document-requests/${id}/remind`);
  return response.data;
}

// ── Portal Document Request API ───────────────────────────────────────────────

export async function getMyDocumentRequests(status?: string): Promise<DocumentRequestListResponse> {
  const response = await api.get<DocumentRequestListResponse>("/api/v1/portal/document-requests", {
    params: status ? { status } : undefined,
  });
  return response.data;
}

export async function getMyDocumentRequest(requestId: string): Promise<DocumentRequestItem> {
  const response = await api.get<DocumentRequestItem>(
    `/api/v1/portal/document-requests/${requestId}`,
  );
  return response.data;
}

export async function fulfillMyDocumentRequest(
  requestId: string,
  file: File,
  category?: string,
  description?: string,
): Promise<DocumentRequestItem> {
  const formData = new FormData();
  formData.append("file", file);
  if (category) formData.append("category", category);
  if (description) formData.append("description", description);
  const response = await api.post<DocumentRequestItem>(
    `/api/v1/portal/document-requests/${requestId}/fulfill`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data;
}

export async function cancelMyDocumentRequest(requestId: string): Promise<DocumentRequestItem> {
  const response = await api.post<DocumentRequestItem>(
    `/api/v1/portal/document-requests/${requestId}/cancel`,
  );
  return response.data;
}

export async function addNoteToMyDocumentRequest(
  requestId: string,
  note: string,
): Promise<DocumentRequestItem> {
  const response = await api.post<DocumentRequestItem>(
    `/api/v1/portal/document-requests/${requestId}/add-note`,
    { note },
  );
  return response.data;
}

export async function compareDocumentVersions(
  versionAId: string,
  versionBId: string,
): Promise<DocumentCompareResponse> {
  const response = await api.get<DocumentCompareResponse>("/api/v1/documents/compare", {
    params: { version_a_id: versionAId, version_b_id: versionBId },
  });
  return response.data;
}

// ── Document Sharing API ──────────────────────────────────────────────────────

export interface DocumentShareCreate {
  shared_with_email: string;
  access_level?: "view" | "download";
  expires_hours?: number;
}

export interface DocumentShare {
  id: string;
  document_id: string;
  shared_by: string;
  shared_with_email: string;
  access_level: string;
  expires_at: string | null;
  access_count: number;
  is_active: boolean;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentShareListResponse {
  shares: DocumentShare[];
  total: number;
}

export interface DocumentShareAccessResponse {
  share_id: string;
  document_id: string;
  file_name: string;
  view_url: string;
  access_level: string;
  expires_at: string | null;
  message: string;
}

export interface DocumentShareInfo {
  share_id: string;
  document_id: string;
  file_name: string;
  shared_with_email: string;
  access_level: string;
  expires_at: string | null;
}

export async function createDocumentShare(
  documentId: string,
  data: DocumentShareCreate,
): Promise<DocumentShare> {
  const response = await api.post<DocumentShare>(
    `/api/v1/documents/${documentId}/shares`,
    data,
  );
  return response.data;
}

export async function listDocumentShares(
  documentId: string,
): Promise<DocumentShareListResponse> {
  const response = await api.get<DocumentShareListResponse>(
    `/api/v1/documents/${documentId}/shares`,
  );
  return response.data;
}

export async function revokeDocumentShare(shareId: string): Promise<void> {
  await api.delete(`/api/v1/documents/shares/${shareId}`);
}

export async function getSharedDocumentInfo(token: string): Promise<DocumentShareInfo> {
  const response = await api.get<DocumentShareInfo>(
    `/api/v1/documents/shared/${token}/info`,
  );
  return response.data;
}

export async function requestShareVerificationCode(token: string): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(
    `/api/v1/documents/shared/${token}/request-code`,
  );
  return response.data;
}

export async function accessSharedDocument(
  token: string,
  verificationCode: string,
): Promise<DocumentShareAccessResponse> {
  const response = await api.post<DocumentShareAccessResponse>(
    `/api/v1/documents/shared/${token}/access`,
    { verification_code: verificationCode },
  );
  return response.data;
}
