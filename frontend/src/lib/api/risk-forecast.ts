import api from "@/lib/api";
import type {
  ClientRiskOverview,
  PredictiveRiskListResponse,
  ProgramHealthSummary,
  RiskAlertListResponse,
  RiskForecastListParams,
  RiskForecastListResponse,
} from "@/types/risk-forecast";

export async function listProgramRiskScores(
  params?: RiskForecastListParams,
): Promise<RiskForecastListResponse> {
  const response = await api.get<RiskForecastListResponse>(
    "/api/v1/risk-forecast/programs",
    { params },
  );
  return response.data;
}

export async function getProgramHealth(
  programId: string,
): Promise<ProgramHealthSummary> {
  const response = await api.get<ProgramHealthSummary>(
    `/api/v1/risk-forecast/programs/${programId}`,
  );
  return response.data;
}

export async function getClientRiskOverview(
  clientId: string,
): Promise<ClientRiskOverview> {
  const response = await api.get<ClientRiskOverview>(
    `/api/v1/risk-forecast/clients/${clientId}`,
  );
  return response.data;
}

export async function listRiskAlerts(
  params?: { skip?: number; limit?: number },
): Promise<RiskAlertListResponse> {
  const response = await api.get<RiskAlertListResponse>(
    "/api/v1/risk-forecast/alerts",
    { params },
  );
  return response.data;
}

export async function listPredictiveRiskAlerts(
  params?: { skip?: number; limit?: number },
): Promise<PredictiveRiskListResponse> {
  const response = await api.get<PredictiveRiskListResponse>(
    "/api/v1/risk-forecast/predictive",
    { params },
  );
  return response.data;
}
