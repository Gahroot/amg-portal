// Custom report builder types

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

export interface CustomReport {
  id: string;
  name: string;
  description: string | null;
  data_source: DataSource;
  fields: ReportField[];
  filters: ReportFilter[];
  sorting: ReportSort[];
  grouping: string[];
  is_template: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CustomReportListResponse {
  reports: CustomReport[];
  total: number;
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
