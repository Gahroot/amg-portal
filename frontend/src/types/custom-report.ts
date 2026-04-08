/**
 * Custom report types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/custom_report.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type CustomReport = components["schemas"]["CustomReportResponse"];
export type CustomReportListResponse = components["schemas"]["CustomReportListResponse"];
export type CustomReportCreateData = components["schemas"]["CustomReportCreate"];
export type CustomReportUpdateData = components["schemas"]["CustomReportUpdate"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums, display helpers
// ---------------------------------------------------------------------------

export type FieldType = "text" | "number" | "date" | "status" | "rag" | "boolean" | "calculated";
export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "not_contains"
  | "in"
  | "not_in"
  | "is_null"
  | "is_not_null";
export type SortDirection = "asc" | "desc";
export type DataSource =
  | "programs"
  | "clients"
  | "partners"
  | "tasks"
  | "milestones"
  | "documents"
  | "communications";
export type ExportFormat = "csv" | "pdf" | "excel";

export interface ReportField {
  key: string;
  label: string;
  type: FieldType;
  expression?: string | null;
}

export interface ReportFilter {
  field: string;
  operator: FilterOperator;
  value?: unknown;
}

export interface ReportSort {
  field: string;
  direction: SortDirection;
}

export interface ReportPreviewRequest {
  data_source: DataSource;
  fields: ReportField[];
  filters: ReportFilter[];
  sorting: ReportSort[];
  grouping: string[];
  page: number;
  page_size: number;
}

export interface ReportColumn {
  key: string;
  label: string;
  type: FieldType;
}

export interface ReportPreviewResponse {
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  page_size: number;
}

export interface DataSourceMeta {
  key: DataSource;
  label: string;
}

export interface FieldMeta {
  key: string;
  label: string;
  type: FieldType;
}
