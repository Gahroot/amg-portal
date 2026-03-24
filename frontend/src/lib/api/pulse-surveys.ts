import api from "@/lib/api";
import type {
  PulseSurvey,
  PulseSurveyClientStatus,
  PulseSurveyCreateData,
  PulseSurveyListParams,
  PulseSurveyListResponse,
  PulseSurveyResponseCreateData,
  PulseSurveyResponseListResponse,
  PulseSurveyStats,
  PulseSurveyUpdateData,
  PulseSurveyResponse,
} from "@/types/pulse-survey";

const BASE = "/api/v1/pulse-surveys";

// ==================== Admin Survey API ====================

export async function listPulseSurveys(
  params?: PulseSurveyListParams
): Promise<PulseSurveyListResponse> {
  const response = await api.get<PulseSurveyListResponse>(`${BASE}/`, { params });
  return response.data;
}

export async function getPulseSurvey(id: string): Promise<PulseSurvey> {
  const response = await api.get<PulseSurvey>(`${BASE}/${id}`);
  return response.data;
}

export async function createPulseSurvey(data: PulseSurveyCreateData): Promise<PulseSurvey> {
  const response = await api.post<PulseSurvey>(`${BASE}/`, data);
  return response.data;
}

export async function updatePulseSurvey(
  id: string,
  data: PulseSurveyUpdateData
): Promise<PulseSurvey> {
  const response = await api.patch<PulseSurvey>(`${BASE}/${id}`, data);
  return response.data;
}

export async function activatePulseSurvey(id: string): Promise<PulseSurvey> {
  const response = await api.post<PulseSurvey>(`${BASE}/${id}/activate`);
  return response.data;
}

export async function closePulseSurvey(id: string): Promise<PulseSurvey> {
  const response = await api.post<PulseSurvey>(`${BASE}/${id}/close`);
  return response.data;
}

export async function getPulseSurveyStats(id: string): Promise<PulseSurveyStats> {
  const response = await api.get<PulseSurveyStats>(`${BASE}/${id}/stats`);
  return response.data;
}

export async function listPulseSurveyResponses(
  id: string,
  params?: { skip?: number; limit?: number }
): Promise<PulseSurveyResponseListResponse> {
  const response = await api.get<PulseSurveyResponseListResponse>(
    `${BASE}/${id}/responses`,
    { params }
  );
  return response.data;
}

// ==================== Client API ====================

export async function getActivePulseForMe(): Promise<PulseSurvey | null> {
  const response = await api.get<PulseSurvey | null>(`${BASE}/active/for-me`);
  return response.data;
}

export async function getMyPulseStatus(
  surveyId: string
): Promise<PulseSurveyClientStatus> {
  const response = await api.get<PulseSurveyClientStatus>(
    `${BASE}/${surveyId}/my-status`
  );
  return response.data;
}

export async function submitPulseResponse(
  surveyId: string,
  data: PulseSurveyResponseCreateData
): Promise<PulseSurveyResponse> {
  const response = await api.post<PulseSurveyResponse>(
    `${BASE}/${surveyId}/respond`,
    data
  );
  return response.data;
}
