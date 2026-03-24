// API client for import endpoints

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
  const response = await fetch(`${API_BASE}/templates/${entityType}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to get template" }));
    throw new Error(error.message || "Failed to get template");
  }

  return response.json();
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

  const response = await fetch(`${API_BASE}/upload?entity_type=${entityType}`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to upload file" }));
    throw new Error(error.detail || error.message || "Failed to upload file");
  }

  return response.json();
}

/**
 * Set column mappings for an import job
 */
export async function mapImportColumns(request: MapColumnsRequest): Promise<ImportJobResponse> {
  const response = await fetch(`${API_BASE}/map-columns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to map columns" }));
    throw new Error(error.detail || error.message || "Failed to map columns");
  }

  return response.json();
}

/**
 * Validate import data
 */
export async function validateImport(request: ValidateRequest): Promise<ImportValidateResponse> {
  const response = await fetch(`${API_BASE}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, skip_duplicates: request.skip_duplicates ?? false }),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to validate import" }));
    throw new Error(error.detail || error.message || "Failed to validate import");
  }

  return response.json();
}

/**
 * Confirm and execute the import
 */
export async function confirmImport(request: ConfirmRequest): Promise<ImportConfirmResponse> {
  const response = await fetch(`${API_BASE}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...request,
      skip_invalid_rows: request.skip_invalid_rows ?? true,
      skip_warnings: request.skip_warnings ?? false,
    }),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to confirm import" }));
    throw new Error(error.detail || error.message || "Failed to confirm import");
  }

  return response.json();
}

/**
 * Get import job details
 */
export async function getImportJob(importId: string): Promise<ImportJobResponse> {
  const response = await fetch(`${API_BASE}/${importId}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to get import job" }));
    throw new Error(error.detail || error.message || "Failed to get import job");
  }

  return response.json();
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
  const response = await fetch(`${API_BASE}/?limit=${limit}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to list import jobs" }));
    throw new Error(error.detail || error.message || "Failed to list import jobs");
  }

  return response.json();
}
