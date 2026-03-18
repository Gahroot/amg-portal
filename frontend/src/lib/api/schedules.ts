import api from "@/lib/api";

// ============================================================================
// Types
// ============================================================================

export interface ReportSchedule {
  id: string;
  report_type: string;
  entity_id: string | null;
  frequency: string;
  next_run: string;
  recipients: string[];
  format: string;
  created_by: string;
  is_active: boolean;
  last_run: string | null;
  last_generated_document_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportScheduleCreate {
  report_type: string;
  entity_id?: string | null;
  frequency: string;
  recipients: string[];
  format?: string;
}

export interface ReportScheduleUpdate {
  frequency?: string;
  recipients?: string[];
  format?: string;
  is_active?: boolean;
}

// ============================================================================
// Client Preferences Types
// ============================================================================

export interface ClientPreferences {
  digest_frequency: string | null;
  report_format: string | null;
  notification_channels: Record<string, boolean> | null;
}

export interface ClientPreferencesUpdate {
  digest_frequency?: string | null;
  report_format?: string | null;
  notification_channels?: Record<string, boolean> | null;
}

export interface EngagementHistoryItem {
  program_id: string;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface EngagementHistoryResponse {
  programs: EngagementHistoryItem[];
  total: number;
}

// ============================================================================
// Report Schedule API Functions
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
  const response = await api.patch<ReportSchedule>(`/api/v1/reports/schedules/${id}`, data);
  return response.data;
}

export async function deleteReportSchedule(id: string): Promise<void> {
  await api.delete(`/api/v1/reports/schedules/${id}`);
}

export async function executeSchedule(id: string): Promise<ReportSchedule> {
  const response = await api.post<ReportSchedule>(`/api/v1/reports/schedules/${id}/execute`);
  return response.data;
}

// ============================================================================
// Client Preferences API Functions
// ============================================================================

export async function getClientPreferences(): Promise<ClientPreferences> {
  const response = await api.get<ClientPreferences>("/api/v1/portal/preferences");
  return response.data;
}

export async function updateClientPreferences(
  data: ClientPreferencesUpdate,
): Promise<ClientPreferences> {
  const response = await api.patch<ClientPreferences>("/api/v1/portal/preferences", data);
  return response.data;
}

export async function getEngagementHistory(): Promise<EngagementHistoryResponse> {
  const response = await api.get<EngagementHistoryResponse>("/api/v1/portal/history");
  return response.data;
}
