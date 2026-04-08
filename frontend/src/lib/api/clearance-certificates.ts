import api from "@/lib/api";
import { createApiClient } from "./factory";

// ============================================================================
// Types
// ============================================================================

export type CertificateTemplateType = "program" | "client" | "partner";
export type CertificateStatus = "draft" | "issued" | "revoked" | "expired";

export interface CertificateTemplate {
  id: string;
  name: string;
  description: string | null;
  template_type: CertificateTemplateType;
  content: string;
  placeholders: Record<string, unknown> | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CertificateTemplateCreate {
  name: string;
  description?: string;
  template_type: CertificateTemplateType;
  content: string;
  placeholders?: Record<string, unknown>;
  is_active?: boolean;
}

export interface CertificateTemplateUpdate {
  name?: string;
  description?: string;
  content?: string;
  placeholders?: Record<string, unknown>;
  is_active?: boolean;
}

export interface CertificateTemplateListResponse {
  templates: CertificateTemplate[];
  total: number;
}

export interface ClearanceCertificate {
  id: string;
  certificate_number: string;
  template_id: string | null;
  template_name: string | null;
  program_id: string | null;
  program_title: string | null;
  client_id: string;
  client_name: string;
  title: string;
  content: string;
  populated_data: Record<string, unknown> | null;
  certificate_type: string;
  status: CertificateStatus;
  issue_date: string | null;
  expiry_date: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  pdf_path: string | null;
  download_url: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClearanceCertificateDetail extends ClearanceCertificate {
  history: CertificateHistoryEntry[];
}

export interface CertificateHistoryEntry {
  id: string;
  certificate_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  actor_id: string;
  actor_name: string;
  notes: string | null;
  created_at: string;
}

export interface ClearanceCertificateCreate {
  template_id?: string;
  program_id?: string;
  client_id: string;
  title: string;
  content?: string;
  certificate_type: string;
  issue_date?: string;
  expiry_date?: string;
}

export interface ClearanceCertificateUpdate {
  title?: string;
  content?: string;
  issue_date?: string;
  expiry_date?: string;
  status?: CertificateStatus;
}

export interface ClearanceCertificateIssue {
  issue_date?: string;
  expiry_date?: string;
  review_notes?: string;
}

export interface ClearanceCertificateRevoke {
  reason: string;
}

export interface ClearanceCertificateListResponse {
  certificates: ClearanceCertificate[];
  total: number;
}

export interface CertificatePreviewRequest {
  template_id?: string;
  program_id?: string;
  client_id: string;
  certificate_type: string;
  title?: string;
  custom_content?: string;
}

export interface CertificatePreviewResponse {
  title: string;
  content: string;
  populated_data: Record<string, unknown>;
  available_placeholders: string[];
}

export interface ClearanceCertificateListParams {
  client_id?: string;
  program_id?: string;
  status?: CertificateStatus;
  certificate_type?: string;
  skip?: number;
  limit?: number;
}

// ============================================================================
// Template API Functions (factory)
// ============================================================================

const templatesApi = createApiClient<
  CertificateTemplate,
  CertificateTemplateListResponse,
  CertificateTemplateCreate,
  CertificateTemplateUpdate
>("/api/v1/clearance-certificates/templates");

export const listTemplates = templatesApi.list as (params?: {
  template_type?: CertificateTemplateType;
  is_active?: boolean;
  skip?: number;
  limit?: number;
}) => Promise<CertificateTemplateListResponse>;
export const getTemplate = templatesApi.get;
export const createTemplate = templatesApi.create;
export const updateTemplate = templatesApi.update;
export const deleteTemplate = templatesApi.delete;

// ============================================================================
// Certificate API Functions (factory for standard CRUD)
// ============================================================================

const certsApi = createApiClient<
  ClearanceCertificate,
  ClearanceCertificateListResponse,
  ClearanceCertificateCreate,
  ClearanceCertificateUpdate
>("/api/v1/clearance-certificates/");

export const listCertificates = certsApi.list as (
  params?: ClearanceCertificateListParams,
) => Promise<ClearanceCertificateListResponse>;
export const createCertificate = certsApi.create;
export const updateCertificate = certsApi.update;
export const deleteCertificate = certsApi.delete;

// getCertificate returns ClearanceCertificateDetail (richer type), so keep manual
export async function getCertificate(id: string): Promise<ClearanceCertificateDetail> {
  const response = await api.get<ClearanceCertificateDetail>(
    `/api/v1/clearance-certificates/${id}`
  );
  return response.data;
}

// Custom endpoints

export async function issueCertificate(
  id: string,
  data: ClearanceCertificateIssue
): Promise<ClearanceCertificate> {
  const response = await api.post<ClearanceCertificate>(
    `/api/v1/clearance-certificates/${id}/issue`,
    data
  );
  return response.data;
}

export async function revokeCertificate(
  id: string,
  data: ClearanceCertificateRevoke
): Promise<ClearanceCertificate> {
  const response = await api.post<ClearanceCertificate>(
    `/api/v1/clearance-certificates/${id}/revoke`,
    data
  );
  return response.data;
}

export async function previewCertificate(
  data: CertificatePreviewRequest
): Promise<CertificatePreviewResponse> {
  const response = await api.post<CertificatePreviewResponse>(
    "/api/v1/clearance-certificates/preview",
    data
  );
  return response.data;
}

// ============================================================================
// PDF Download Helpers
// ============================================================================

function dateStr(): string {
  return new Date().toISOString().split("T")[0];
}

function downloadBlob(data: Blob, filename: string): void {
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadCertificatePDF(id: string, number: string): Promise<void> {
  const response = await api.get(`/api/v1/clearance-certificates/${id}/pdf`, {
    responseType: "blob",
  });
  downloadBlob(response.data, `certificate_${number}_${dateStr()}.pdf`);
}

export async function getCertificateDownloadUrl(id: string): Promise<string> {
  const response = await api.get<{ download_url: string }>(
    `/api/v1/clearance-certificates/${id}/download`
  );
  return response.data.download_url;
}
