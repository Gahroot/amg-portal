// API client for import endpoints

import api from "@/lib/api";
import type {
  ImportEntityType,
  ImportJobListResponse,
  ImportJobResponse,
  ImportTemplate,
  ImportUploadResponse,
  ImportValidateResponse,
  ImportConfirmResponse,
  ColumnMapping,
} from "@/types/import";

const API_BASE = "/api/v1/imports";

interface MapColumnsRequest {
  import_id: string;
  mappings: ColumnMapping[];
  default_values?: Record<string, unknown>;
}

interface ValidateRequest {
  import_id: string;
  skip_duplicates?: boolean;
}

interface ConfirmRequest {
  import_id: string;
  skip_invalid_rows?: boolean;
  skip_warnings?: boolean;
}

/**
 * Get import template for an entity type
 */
export async function getImportTemplate(entityType: ImportEntityType): Promise<ImportTemplate> {
  const response = await api.get<ImportTemplate>(`${API_BASE}/templates/${entityType}`);
  return response.data;
}

/**
 * Download template CSV file
 */
export function getTemplateDownloadUrl(entityType: ImportEntityType): string {
  return `${API_BASE}/templates/${entityType}/download`;
}

/**
 * Upload a file for import
 */
export async function uploadImportFile(
  file: File,
  entityType: ImportEntityType
): Promise<ImportUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<ImportUploadResponse>(
    `${API_BASE}/upload`,
    formData,
    { params: { entity_type: entityType } }
  );
  return response.data;
}

/**
 * Set column mappings for an import job
 */
export async function mapImportColumns(request: MapColumnsRequest): Promise<ImportJobResponse> {
  const response = await api.post<ImportJobResponse>(`${API_BASE}/map-columns`, request);
  return response.data;
}

/**
 * Validate import data
 */
export async function validateImport(request: ValidateRequest): Promise<ImportValidateResponse> {
  const response = await api.post<ImportValidateResponse>(`${API_BASE}/validate`, {
    ...request,
    skip_duplicates: request.skip_duplicates ?? false,
  });
  return response.data;
}

/**
 * Confirm and execute the import
 */
export async function confirmImport(request: ConfirmRequest): Promise<ImportConfirmResponse> {
  const response = await api.post<ImportConfirmResponse>(`${API_BASE}/confirm`, {
    ...request,
    skip_invalid_rows: request.skip_invalid_rows ?? true,
    skip_warnings: request.skip_warnings ?? false,
  });
  return response.data;
}

/**
 * Get import job details
 */
export async function getImportJob(importId: string): Promise<ImportJobResponse> {
  const response = await api.get<ImportJobResponse>(`${API_BASE}/${importId}`);
  return response.data;
}

/**
 * Get error report download URL
 */
export function getErrorReportDownloadUrl(importId: string): string {
  return `${API_BASE}/${importId}/errors/download`;
}

/**
 * List recent import jobs
 */
export async function listImportJobs(limit = 20): Promise<ImportJobListResponse> {
  const response = await api.get<ImportJobListResponse>(`${API_BASE}/`, {
    params: { limit },
  });
  return response.data;
}
