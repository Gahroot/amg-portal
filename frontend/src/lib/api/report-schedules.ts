/**
 * Dedicated API client for report schedule CRUD operations.
 * Endpoints: POST/GET/PATCH/DELETE /api/v1/reports/schedules
 */

import api from "@/lib/api";

// ============================================================================
// Types
// ============================================================================

export type ReportType =
  | "portfolio"
  | "program_status"
  | "completion"
  | "annual_review"
  | "partner_performance";

export type ReportFrequency = "daily" | "weekly" | "monthly" | "quarterly";

export type ReportFormat = "pdf" | "csv";

export interface ReportSchedule {
  id: string;
  report_type: ReportType;
  entity_id: string | null;
  frequency: ReportFrequency;
  next_run: string;
  recipients: string[];
  format: ReportFormat;
  created_by: string;
  is_active: boolean;
  last_run: string | null;
  last_generated_document_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportScheduleCreate {
  report_type: ReportType;
  entity_id?: string | null;
  frequency: ReportFrequency;
  recipients: string[];
  format?: ReportFormat;
}

export interface ReportScheduleUpdate {
  frequency?: ReportFrequency;
  recipients?: string[];
  format?: ReportFormat;
  is_active?: boolean;
}

// ============================================================================
// API functions
// ============================================================================

export async function listReportSchedules(): Promise<ReportSchedule[]> {
  const response = await api.get<ReportSchedule[]>("/api/v1/reports/schedules");
  return response.data;
}

export async function createReportSchedule(
  data: ReportScheduleCreate,
): Promise<ReportSchedule> {
  const response = await api.post<ReportSchedule>("/api/v1/reports/schedules", data);
  return response.data;
}

export async function updateReportSchedule(
  id: string,
  data: ReportScheduleUpdate,
): Promise<ReportSchedule> {
  const response = await api.patch<ReportSchedule>(
    `/api/v1/reports/schedules/${id}`,
    data,
  );
  return response.data;
}

export async function deleteReportSchedule(id: string): Promise<void> {
  await api.delete(`/api/v1/reports/schedules/${id}`);
}

export async function executeReportSchedule(id: string): Promise<ReportSchedule> {
  const response = await api.post<ReportSchedule>(
    `/api/v1/reports/schedules/${id}/execute`,
  );
  return response.data;
}

// ============================================================================
// Display helpers
// ============================================================================

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  portfolio: "Portfolio Overview",
  program_status: "Program Status",
  completion: "Completion Report",
  annual_review: "Annual Review",
  partner_performance: "Partner Performance",
};

export const FREQUENCY_LABELS: Record<ReportFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

export const FORMAT_LABELS: Record<ReportFormat, string> = {
  pdf: "PDF",
  csv: "CSV",
};

/** Which report types require an entity_id (program or client) */
export const ENTITY_REQUIRED_TYPES: ReportType[] = [
  "program_status",
  "completion",
];

export const ENTITY_PLACEHOLDER: Record<ReportType, string> = {
  portfolio: "",
  program_status: "Program ID",
  completion: "Program ID",
  annual_review: "Client ID (optional)",
  partner_performance: "Partner ID (optional)",
};
