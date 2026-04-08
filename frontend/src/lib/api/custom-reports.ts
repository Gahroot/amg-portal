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
import { createApiClient } from "./factory";

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

const reportsApi = createApiClient<
  CustomReport,
  CustomReportListResponse,
  CustomReportCreate,
  CustomReportUpdate
>("/api/v1/custom-reports/");

export const listCustomReports = reportsApi.list as () => Promise<CustomReportListResponse>;
export const getCustomReport = reportsApi.get;
export const createCustomReport = reportsApi.create;
export const updateCustomReport = reportsApi.update;
export const deleteCustomReport = reportsApi.delete;

// ============================================================================
// Export
// ============================================================================

export function buildExportUrl(
  reportId: string,
  _format: ExportFormat,
): string {
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
