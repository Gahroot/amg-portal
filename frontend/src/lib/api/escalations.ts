import api from "@/lib/api";
import type {
  Escalation,
  EscalationCreate,
  EscalationDetailedMetrics,
  EscalationListResponse,
  EscalationMetricsParams,
  EscalationSimpleMetrics,
  EscalationUpdate,
  OverdueEscalationListResponse,
} from "@/types/escalation";
import { createApiClient } from "./factory";

export interface EscalationListParams {
  skip?: number;
  limit?: number;
  level?: string;
  status?: string;
  program_id?: string;
  client_id?: string;
  search?: string;
}

const escalationsApi = createApiClient<
  Escalation,
  EscalationListResponse,
  EscalationCreate,
  EscalationUpdate
>("/api/v1/escalations/", { updateMethod: "put" });

export const listEscalations = escalationsApi.list as (
  params?: EscalationListParams,
) => Promise<EscalationListResponse>;
export const getEscalation = escalationsApi.get;
export const createEscalation = escalationsApi.create;
export const updateEscalation = escalationsApi.update;

// Custom endpoints

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

export async function getEscalationMetrics(
  params?: EscalationMetricsParams,
): Promise<EscalationDetailedMetrics> {
  const response = await api.get<EscalationDetailedMetrics>("/api/v1/escalations/metrics", {
    params,
  });
  return response.data;
}

export async function getSimpleEscalationMetrics(): Promise<EscalationSimpleMetrics> {
  const response = await api.get<EscalationSimpleMetrics>("/api/v1/escalations/simple-metrics");
  return response.data;
}

export async function getOverdueEscalations(params?: {
  skip?: number;
  limit?: number;
}): Promise<OverdueEscalationListResponse> {
  const response = await api.get<OverdueEscalationListResponse>(
    "/api/v1/escalations/overdue",
    { params },
  );
  return response.data;
}

export async function reassignEscalation(
  id: string,
  newOwnerId: string,
): Promise<Escalation> {
  const response = await api.post<Escalation>(
    `/api/v1/escalations/${id}/reassign`,
    { new_owner_id: newOwnerId },
  );
  return response.data;
}
