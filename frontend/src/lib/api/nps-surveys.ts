import api from "@/lib/api";
import type {
  NPSSurvey,
  NPSSurveyListResponse,
  NPSSurveyCreateData,
  NPSSurveyUpdateData,
  NPSSurveyStats,
  NPSTrendAnalysis,
  NPSResponse,
  NPSResponseListResponse,
  NPSResponseCreateData,
  NPSFollowUp,
  NPSFollowUpListResponse,
  NPSFollowUpUpdateData,
  NPSSurveyListParams,
  NPSResponseListParams,
  NPSFollowUpListParams,
} from "@/types/nps-survey";
import { createApiClient } from "./factory";

// ==================== Survey API ====================

const surveysApi = createApiClient<
  NPSSurvey,
  NPSSurveyListResponse,
  NPSSurveyCreateData,
  NPSSurveyUpdateData
>("/api/v1/nps-surveys/");

export const listNPSSurveys = surveysApi.list as (
  params?: NPSSurveyListParams,
) => Promise<NPSSurveyListResponse>;
export const getNPSSurvey = surveysApi.get;
export const createNPSSurvey = surveysApi.create;
export const updateNPSSurvey = surveysApi.update;

// Custom survey endpoints

export async function getActiveNPSSurvey(): Promise<NPSSurvey | null> {
  const response = await api.get<NPSSurvey | null>("/api/v1/nps-surveys/active");
  return response.data;
}

export async function activateNPSSurvey(id: string): Promise<NPSSurvey> {
  const response = await api.post<NPSSurvey>(`/api/v1/nps-surveys/${id}/activate`);
  return response.data;
}

export async function closeNPSSurvey(id: string): Promise<NPSSurvey> {
  const response = await api.post<NPSSurvey>(`/api/v1/nps-surveys/${id}/close`);
  return response.data;
}

export async function getNPSSurveyStats(id: string): Promise<NPSSurveyStats> {
  const response = await api.get<NPSSurveyStats>(`/api/v1/nps-surveys/${id}/stats`);
  return response.data;
}

export async function getNPSTrendAnalysis(params?: {
  client_profile_id?: string;
  quarters?: number;
}): Promise<NPSTrendAnalysis> {
  const response = await api.get<NPSTrendAnalysis>(
    "/api/v1/nps-surveys/trends/analysis",
    { params }
  );
  return response.data;
}

// ==================== Response API ====================

export async function listNPSResponses(
  surveyId: string,
  params?: NPSResponseListParams
): Promise<NPSResponseListResponse> {
  const response = await api.get<NPSResponseListResponse>(
    `/api/v1/nps-surveys/${surveyId}/responses`,
    { params }
  );
  return response.data;
}

export async function submitNPSResponse(
  surveyId: string,
  data: NPSResponseCreateData
): Promise<NPSResponse> {
  const response = await api.post<NPSResponse>(
    `/api/v1/nps-surveys/${surveyId}/responses`,
    data
  );
  return response.data;
}

export async function getNPSResponse(
  surveyId: string,
  responseId: string
): Promise<NPSResponse> {
  const response = await api.get<NPSResponse>(
    `/api/v1/nps-surveys/${surveyId}/responses/${responseId}`
  );
  return response.data;
}

// ==================== Follow-Up API ====================

export async function listNPSFollowUps(
  surveyId: string,
  params?: NPSFollowUpListParams
): Promise<NPSFollowUpListResponse> {
  const response = await api.get<NPSFollowUpListResponse>(
    `/api/v1/nps-surveys/${surveyId}/follow-ups`,
    { params }
  );
  return response.data;
}

export async function listMyNPSFollowUps(
  params?: NPSFollowUpListParams
): Promise<NPSFollowUpListResponse> {
  const response = await api.get<NPSFollowUpListResponse>(
    "/api/v1/nps-surveys/follow-ups/my",
    { params }
  );
  return response.data;
}

export async function getNPSFollowUp(followUpId: string): Promise<NPSFollowUp> {
  const response = await api.get<NPSFollowUp>(
    `/api/v1/nps-surveys/follow-ups/${followUpId}`
  );
  return response.data;
}

export async function updateNPSFollowUp(
  followUpId: string,
  data: NPSFollowUpUpdateData
): Promise<NPSFollowUp> {
  const response = await api.patch<NPSFollowUp>(
    `/api/v1/nps-surveys/follow-ups/${followUpId}`,
    data
  );
  return response.data;
}

export async function acknowledgeNPSFollowUp(followUpId: string): Promise<NPSFollowUp> {
  const response = await api.post<NPSFollowUp>(
    `/api/v1/nps-surveys/follow-ups/${followUpId}/acknowledge`
  );
  return response.data;
}

export async function completeNPSFollowUp(
  followUpId: string,
  resolutionNotes?: string
): Promise<NPSFollowUp> {
  const response = await api.post<NPSFollowUp>(
    `/api/v1/nps-surveys/follow-ups/${followUpId}/complete`,
    null,
    { params: { resolution_notes: resolutionNotes } }
  );
  return response.data;
}
