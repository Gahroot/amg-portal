import api from "@/lib/api";
import type {
  EnvelopeItem,
  EnvelopeListResponse,
  EnvelopeSigningSession,
} from "@/types/document";

export interface EnvelopeListParams {
  status?: string;
  skip?: number;
  limit?: number;
}

export async function listEnvelopes(
  params?: EnvelopeListParams,
): Promise<EnvelopeListResponse> {
  const response = await api.get<EnvelopeListResponse>(
    "/api/v1/envelopes/",
    { params },
  );
  return response.data;
}

export async function getEnvelope(id: string): Promise<EnvelopeItem> {
  const response = await api.get<EnvelopeItem>(`/api/v1/envelopes/${id}`);
  return response.data;
}

export async function getSigningSession(
  id: string,
): Promise<EnvelopeSigningSession> {
  const response = await api.post<EnvelopeSigningSession>(
    `/api/v1/envelopes/${id}/signing-session`,
  );
  return response.data;
}

// Partner-facing API functions

export async function listPartnerEnvelopes(
  params?: EnvelopeListParams,
): Promise<EnvelopeListResponse> {
  const response = await api.get<EnvelopeListResponse>(
    "/api/v1/envelopes/partner/me",
    { params },
  );
  return response.data;
}

export async function getPartnerEnvelope(
  id: string,
): Promise<EnvelopeItem> {
  const response = await api.get<EnvelopeItem>(
    `/api/v1/envelopes/partner/${id}`,
  );
  return response.data;
}

export async function getPartnerSigningSession(
  id: string,
): Promise<EnvelopeSigningSession> {
  const response = await api.post<EnvelopeSigningSession>(
    `/api/v1/envelopes/partner/${id}/signing-session`,
  );
  return response.data;
}
