import api from "@/lib/api";
import type {
  SLACreate,
  SLABreachAlertResponse,
  SLATrackerListResponse,
} from "@/types/sla";

export interface SLAListParams {
  skip?: number;
  limit?: number;
  breach_status?: string;
  entity_type?: string;
}

export async function listSLATrackers(
  params?: SLAListParams,
): Promise<SLATrackerListResponse> {
  const response = await api.get<SLATrackerListResponse>("/api/v1/sla/", {
    params,
  });
  return response.data;
}

export async function getSLABreaches(
  includeApproaching = true,
): Promise<SLABreachAlertResponse[]> {
  const response = await api.get<SLABreachAlertResponse[]>(
    "/api/v1/sla/breaches",
    { params: { include_approaching: includeApproaching } },
  );
  return response.data;
}

export async function startSLAClock(data: SLACreate): Promise<SLABreachAlertResponse> {
  const response = await api.post<SLABreachAlertResponse>("/api/v1/sla/", data);
  return response.data;
}

export async function respondToSLA(id: string): Promise<SLABreachAlertResponse> {
  const response = await api.post<SLABreachAlertResponse>(
    `/api/v1/sla/${id}/respond`,
  );
  return response.data;
}

export async function getEntitySLATrackers(
  entityType: string,
  entityId: string,
  params?: SLAListParams,
): Promise<SLATrackerListResponse> {
  const response = await api.get<SLATrackerListResponse>(
    `/api/v1/sla/entity/${entityType}/${entityId}`,
    { params },
  );
  return response.data;
}
