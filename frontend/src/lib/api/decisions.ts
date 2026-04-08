import api from "@/lib/api";
import type {
  DecisionRequest,
  DecisionListResponse,
  DecisionCreateData,
  DecisionResponseData,
} from "@/types/communication";
import { createApiClient } from "./factory";

export interface DecisionListParams {
  client_id?: string;
  status?: string;
  skip?: number;
  limit?: number;
}

export interface PendingDecisionListParams {
  skip?: number;
  limit?: number;
}

const decisionsApi = createApiClient<
  DecisionRequest,
  DecisionListResponse,
  DecisionCreateData,
  Partial<DecisionCreateData>
>("/api/v1/decisions/");

export const listDecisions = decisionsApi.list as (
  params?: DecisionListParams,
) => Promise<DecisionListResponse>;
export const getDecision = decisionsApi.get;
export const createDecision = decisionsApi.create;
export const updateDecision = decisionsApi.update;

// Custom endpoints

export async function listPendingDecisions(
  params?: PendingDecisionListParams
): Promise<DecisionListResponse> {
  const response = await api.get<DecisionListResponse>(
    "/api/v1/decisions/pending",
    { params }
  );
  return response.data;
}

export async function respondToDecision(
  id: string,
  data: DecisionResponseData
): Promise<DecisionRequest> {
  const response = await api.post<DecisionRequest>(
    `/api/v1/decisions/${id}/respond`,
    { response: data }
  );
  return response.data;
}
