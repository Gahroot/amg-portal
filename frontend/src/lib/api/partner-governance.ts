import api from "@/lib/api";
import type {
  CompositeScore,
  GovernanceAction,
  GovernanceActionCreate,
  GovernanceDashboardResponse,
  GovernanceHistoryResponse,
} from "@/types/partner-governance";

export async function getGovernanceHistory(
  partnerId: string,
): Promise<GovernanceHistoryResponse> {
  const response = await api.get<GovernanceHistoryResponse>(
    `/api/v1/partner-governance/${partnerId}/governance`,
  );
  return response.data;
}

export async function createGovernanceAction(
  partnerId: string,
  data: GovernanceActionCreate,
): Promise<GovernanceAction> {
  const response = await api.post<GovernanceAction>(
    `/api/v1/partner-governance/${partnerId}/governance`,
    data,
  );
  return response.data;
}

export async function getCompositeScore(
  partnerId: string,
): Promise<CompositeScore> {
  const response = await api.get<CompositeScore>(
    `/api/v1/partner-governance/${partnerId}/composite-score`,
  );
  return response.data;
}

export async function getGovernanceDashboard(params?: {
  skip?: number;
  limit?: number;
}): Promise<GovernanceDashboardResponse> {
  const response = await api.get<GovernanceDashboardResponse>(
    "/api/v1/partner-governance/dashboard",
    { params },
  );
  return response.data;
}
