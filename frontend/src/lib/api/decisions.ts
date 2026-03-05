import api from "@/lib/api";
import type {
  DecisionRequest,
  DecisionListResponse,
  DecisionCreateData,
  DecisionResponseData,
} from "@/types/communication";

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

// Decisions
export async function listDecisions(
  params?: DecisionListParams
): Promise<DecisionListResponse> {
  const response = await api.get<DecisionListResponse>(
    "/api/v1/decisions/",
    { params }
  );
  return response.data;
}

export async function listPendingDecisions(
  params?: PendingDecisionListParams
): Promise<DecisionListResponse> {
  const response = await api.get<DecisionListResponse>(
    "/api/v1/decisions/pending",
    { params }
  );
  return response.data;
}

export async function getDecision(id: string): Promise<DecisionRequest> {
  const response = await api.get<DecisionRequest>(`/api/v1/decisions/${id}`);
  return response.data;
}

export async function createDecision(
  data: DecisionCreateData
): Promise<DecisionRequest> {
  const response = await api.post<DecisionRequest>("/api/v1/decisions/", data);
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

export async function updateDecision(
  id: string,
  data: Partial<DecisionCreateData>
): Promise<DecisionRequest> {
  const response = await api.patch<DecisionRequest>(
    `/api/v1/decisions/${id}`,
    data
  );
  return response.data;
}
