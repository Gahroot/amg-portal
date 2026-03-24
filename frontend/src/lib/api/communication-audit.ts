import api from "@/lib/api";
import type {
  CommunicationAuditListResponse,
  CommunicationAuditSearchParams,
  CommunicationPreferences,
  CommunicationPreferencesUpdate,
  ChannelCheckResponse,
} from "@/types/communication-audit";

export async function getCommunicationAuditTrail(
  communicationId: string,
  params?: { skip?: number; limit?: number }
): Promise<CommunicationAuditListResponse> {
  const response = await api.get<CommunicationAuditListResponse>(
    `/api/v1/audit-trail/communications/${communicationId}/audit-trail`,
    { params }
  );
  return response.data;
}

export async function searchCommunicationAudits(
  params?: CommunicationAuditSearchParams
): Promise<CommunicationAuditListResponse> {
  const response = await api.get<CommunicationAuditListResponse>(
    "/api/v1/audit-trail/communications",
    { params }
  );
  return response.data;
}

export async function getClientCommunicationPreferences(
  clientId: string
): Promise<CommunicationPreferences> {
  const response = await api.get<CommunicationPreferences>(
    `/api/v1/clients/${clientId}/communication-preferences`
  );
  return response.data;
}

export async function updateClientCommunicationPreferences(
  clientId: string,
  data: CommunicationPreferencesUpdate
): Promise<CommunicationPreferences> {
  const response = await api.put<CommunicationPreferences>(
    `/api/v1/clients/${clientId}/communication-preferences`,
    data
  );
  return response.data;
}

export async function checkChannelAllowed(
  clientId: string,
  channel: string
): Promise<ChannelCheckResponse> {
  const response = await api.get<ChannelCheckResponse>(
    `/api/v1/clients/${clientId}/communication-preferences/check`,
    { params: { channel } }
  );
  return response.data;
}
