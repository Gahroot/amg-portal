export type ComplianceReportType =
  | "kyc_summary"
  | "risk_assessment"
  | "aml_screening"
  | "sanctions_check"
  | "regulatory_filing"
  | "audit_trail";

export type ComplianceReportStatus =
  | "pending"
  | "generating"
  | "completed"
  | "failed";

export type ComplianceReportFormat = "pdf" | "csv" | "xlsx";

export interface ComplianceReport {
  id: string;
  report_type: ComplianceReportType;
  title: string;
  status: ComplianceReportStatus;
  format: ComplianceReportFormat;
  generated_by: string | null;
  generated_by_name: string | null;
  created_at: string;
  completed_at: string | null;
  file_url: string | null;
  parameters: Record<string, string | number | boolean | null>;
}

export interface ComplianceReportListResponse {
  reports: ComplianceReport[];
  total: number;
}

export interface ComplianceReportListParams {
  report_type?: ComplianceReportType;
  status?: ComplianceReportStatus;
  date_from?: string;
  date_to?: string;
  skip?: number;
  limit?: number;
}

export interface ComplianceReportGenerateRequest {
  report_type: ComplianceReportType;
  title: string;
  format: ComplianceReportFormat;
  parameters?: Record<string, string | number | boolean | null>;
}
