import api from "@/lib/api";
import type {
  KYCVerification,
  KYCVerificationListResponse,
  KYCVerificationListParams,
  KYCVerifyRequest,
  KYCExpiringListParams,
} from "@/types/kyc-verification";

export async function uploadKYCDocument(
  clientId: string,
  file: File,
  documentType: string,
  expiryDate?: string,
  notes?: string,
): Promise<KYCVerification> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("document_type", documentType);
  if (expiryDate) formData.append("expiry_date", expiryDate);
  if (notes) formData.append("notes", notes);
  const response = await api.post<KYCVerification>(
    `/api/v1/kyc/clients/${clientId}/kyc-documents`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data;
}

export async function listAllKYCVerifications(
  params?: KYCVerificationListParams,
): Promise<KYCVerificationListResponse> {
  const response = await api.get<KYCVerificationListResponse>(
    "/api/v1/kyc/kyc-documents",
    { params },
  );
  return response.data;
}

export async function listKYCVerifications(
  clientId: string,
  params?: KYCVerificationListParams,
): Promise<KYCVerificationListResponse> {
  const response = await api.get<KYCVerificationListResponse>(
    `/api/v1/kyc/clients/${clientId}/kyc-documents`,
    { params },
  );
  return response.data;
}

export async function getKYCVerification(
  clientId: string,
  kycId: string,
): Promise<KYCVerification> {
  const response = await api.get<KYCVerification>(
    `/api/v1/kyc/clients/${clientId}/kyc-documents/${kycId}`,
  );
  return response.data;
}

export async function verifyKYCDocument(
  clientId: string,
  kycId: string,
  data: KYCVerifyRequest,
): Promise<KYCVerification> {
  const response = await api.post<KYCVerification>(
    `/api/v1/kyc/clients/${clientId}/kyc-documents/${kycId}/verify`,
    data,
  );
  return response.data;
}

export async function listExpiringKYCDocuments(
  params?: KYCExpiringListParams,
): Promise<KYCVerificationListResponse> {
  const response = await api.get<KYCVerificationListResponse>(
    "/api/v1/kyc/kyc-documents/expiring",
    { params },
  );
  return response.data;
}
