import api from "@/lib/api";

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditLogListResponse {
  logs: AuditLog[];
  total: number;
}

export interface AuditLogListParams {
  skip?: number;
  limit?: number;
  entity_type?: string;
  action?: string;
  user_id?: string;
  entity_id?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
}

export async function listAuditLogs(
  params?: AuditLogListParams
): Promise<AuditLogListResponse> {
  const response = await api.get<AuditLogListResponse>("/api/v1/audit-logs/", {
    params,
  });
  return response.data;
}

export async function getAuditLog(id: string): Promise<AuditLog> {
  const response = await api.get<AuditLog>(`/api/v1/audit-logs/${id}`);
  return response.data;
}

export async function getEntityAuditHistory(
  entityType: string,
  entityId: string
): Promise<AuditLogListResponse> {
  const response = await api.get<AuditLogListResponse>(
    `/api/v1/audit-logs/entity/${entityType}/${entityId}`
  );
  return response.data;
}

export async function exportAuditLogsCsv(
  params?: AuditLogListParams
): Promise<Blob> {
  const response = await api.get("/api/v1/audit-logs/export", {
    params,
    responseType: "blob",
  });
  return response.data as Blob;
}
