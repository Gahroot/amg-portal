import api from "@/lib/api";
import type { KYCDocumentItem, KYCDocumentListResponse, KYCVerifyData } from "@/types/document";

export async function uploadKYCDocument(
  clientId: string,
  file: File,
  documentType: string,
  expiryDate?: string,
  notes?: string,
): Promise<KYCDocumentItem> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("document_type", documentType);
  if (expiryDate) formData.append("expiry_date", expiryDate);
  if (notes) formData.append("notes", notes);
  const response = await api.post<KYCDocumentItem>(
    `/api/v1/kyc/clients/${clientId}/kyc-documents`,
    formData,
  );
  return response.data;
}

export async function listKYCDocuments(clientId: string): Promise<KYCDocumentListResponse> {
  const response = await api.get<KYCDocumentListResponse>(
    `/api/v1/kyc/clients/${clientId}/kyc-documents`,
  );
  return response.data;
}

export async function getKYCDocument(clientId: string, kycId: string): Promise<KYCDocumentItem> {
  const response = await api.get<KYCDocumentItem>(
    `/api/v1/kyc/clients/${clientId}/kyc-documents/${kycId}`,
  );
  return response.data;
}

export async function verifyKYCDocument(
  clientId: string,
  kycId: string,
  data: KYCVerifyData,
): Promise<KYCDocumentItem> {
  const response = await api.post<KYCDocumentItem>(
    `/api/v1/kyc/clients/${clientId}/kyc-documents/${kycId}/verify`,
    data,
  );
  return response.data;
}

export async function listExpiringKYCDocuments(
  days?: number,
): Promise<KYCDocumentListResponse> {
  const response = await api.get<KYCDocumentListResponse>(
    "/api/v1/kyc/kyc-documents/expiring",
    { params: days !== undefined ? { days } : undefined },
  );
  return response.data;
}
