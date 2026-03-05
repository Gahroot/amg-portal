import api from "@/lib/api";
import type {
  Escalation,
  EscalationCreate,
  EscalationListResponse,
  EscalationUpdate,
} from "@/types/escalation";

export interface EscalationListParams {
  skip?: number;
  limit?: number;
  level?: string;
  status?: string;
  program_id?: string;
  client_id?: string;
}

export async function listEscalations(
  params?: EscalationListParams,
): Promise<EscalationListResponse> {
  const response = await api.get<EscalationListResponse>("/api/v1/escalations/", {
    params,
  });
  return response.data;
}

export async function getEscalation(id: string): Promise<Escalation> {
  const response = await api.get<Escalation>(`/api/v1/escalations/${id}`);
  return response.data;
}

export async function createEscalation(
  data: EscalationCreate,
): Promise<Escalation> {
  const response = await api.post<Escalation>("/api/v1/escalations/", data);
  return response.data;
}

export async function updateEscalation(
  id: string,
  data: EscalationUpdate,
): Promise<Escalation> {
  const response = await api.put<Escalation>(`/api/v1/escalations/${id}`, data);
  return response.data;
}

export async function acknowledgeEscalation(
  id: string,
): Promise<Escalation> {
  const response = await api.post<Escalation>(
    `/api/v1/escalations/${id}/acknowledge`,
  );
  return response.data;
}

export async function resolveEscalation(
  id: string,
  notes?: string,
): Promise<Escalation> {
  const response = await api.post<Escalation>(
    `/api/v1/escalations/${id}/resolve`,
    { notes },
  );
  return response.data;
}

export async function getEntityEscalations(
  entityType: string,
  entityId: string,
): Promise<EscalationListResponse> {
  const response = await api.get<EscalationListResponse>(
    `/api/v1/escalations/entity/${entityType}/${entityId}`,
  );
  return response.data;
}

export async function triggerRiskCheck(
  entityType: string,
  entityId: string,
  level: string,
  reason: string,
): Promise<Escalation[]> {
  const response = await api.post<Escalation[]>("/api/v1/escalations/check-risks", {
    entity_type: entityType,
    entity_id: entityId,
    level,
    reason,
  });
  return response.data;
}

export async function exportEscalationsCsv(
  params?: EscalationListParams,
): Promise<Blob> {
  const response = await api.get("/api/v1/escalations/export", {
    params,
    responseType: "blob",
  });
  return response.data as Blob;
}
