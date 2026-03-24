import api from "@/lib/api";
import type {
  CustomReport,
  CustomReportListResponse,
  DataSourceMeta,
  ExportFormat,
  FieldMeta,
  ReportField,
  ReportFilter,
  ReportPreviewRequest,
  ReportPreviewResponse,
  ReportSort,
} from "@/types/custom-report";

export type {
  CustomReport,
  CustomReportListResponse,
  DataSourceMeta,
  ExportFormat,
  FieldMeta,
  ReportField,
  ReportFilter,
  ReportPreviewRequest,
  ReportPreviewResponse,
  ReportSort,
};

// ============================================================================
// Data source catalogue
// ============================================================================

export async function getDataSources(): Promise<DataSourceMeta[]> {
  const res = await api.get<DataSourceMeta[]>("/api/v1/custom-reports/data-sources");
  return res.data;
}

export async function getSourceFields(source: string): Promise<FieldMeta[]> {
  const res = await api.get<FieldMeta[]>(
    `/api/v1/custom-reports/data-sources/${source}/fields`,
  );
  return res.data;
}

// ============================================================================
// Preview
// ============================================================================

export async function previewReport(
  payload: ReportPreviewRequest,
): Promise<ReportPreviewResponse> {
  const res = await api.post<ReportPreviewResponse>(
    "/api/v1/custom-reports/preview",
    payload,
  );
  return res.data;
}

// ============================================================================
// CRUD
// ============================================================================

export interface CustomReportCreate {
  name: string;
  description?: string | null;
  data_source: string;
  fields: ReportField[];
  filters: ReportFilter[];
  sorting: ReportSort[];
  grouping: string[];
  is_template?: boolean;
}

export interface CustomReportUpdate {
  name?: string;
  description?: string | null;
  data_source?: string;
  fields?: ReportField[];
  filters?: ReportFilter[];
  sorting?: ReportSort[];
  grouping?: string[];
  is_template?: boolean;
}

export async function listCustomReports(): Promise<CustomReportListResponse> {
  const res = await api.get<CustomReportListResponse>("/api/v1/custom-reports/");
  return res.data;
}

export async function getCustomReport(id: string): Promise<CustomReport> {
  const res = await api.get<CustomReport>(`/api/v1/custom-reports/${id}`);
  return res.data;
}

export async function createCustomReport(payload: CustomReportCreate): Promise<CustomReport> {
  const res = await api.post<CustomReport>("/api/v1/custom-reports/", payload);
  return res.data;
}

export async function updateCustomReport(
  id: string,
  payload: CustomReportUpdate,
): Promise<CustomReport> {
  const res = await api.patch<CustomReport>(`/api/v1/custom-reports/${id}`, payload);
  return res.data;
}

export async function deleteCustomReport(id: string): Promise<void> {
  await api.delete(`/api/v1/custom-reports/${id}`);
}

// ============================================================================
// Export
// ============================================================================

export function buildExportUrl(
  reportId: string,
  format: ExportFormat,
): string {
  // Returns URL for triggering a download via browser
  return `/api/v1/custom-reports/${reportId}/export`;
}

export async function exportReport(
  id: string,
  format: ExportFormat,
  filters?: ReportFilter[],
): Promise<Blob> {
  const res = await api.post(
    `/api/v1/custom-reports/${id}/export`,
    { format, filters },
    { responseType: "blob" },
  );
  return res.data as Blob;
}
