import api from "@/lib/api";
import { createApiClient } from "./factory";
import type {
  Opportunity,
  OpportunityCreateData,
  OpportunityListParams,
  OpportunityListResponse,
  OpportunityReorderRequest,
  OpportunityUpdateData,
  PipelineSummary,
} from "@/types/crm";

const opportunitiesApi = createApiClient<
  Opportunity,
  OpportunityListResponse,
  OpportunityCreateData,
  OpportunityUpdateData
>("/api/v1/opportunities/");

export const listOpportunities = opportunitiesApi.list as (
  params?: OpportunityListParams,
) => Promise<OpportunityListResponse>;
export const getOpportunity = opportunitiesApi.get;
export const createOpportunity = opportunitiesApi.create;
export const updateOpportunity = opportunitiesApi.update;
export const deleteOpportunity = opportunitiesApi.delete;

export async function reorderOpportunity(
  id: string,
  data: OpportunityReorderRequest,
): Promise<Opportunity> {
  const response = await api.post<Opportunity>(
    `/api/v1/opportunities/${id}/reorder`,
    data,
  );
  return response.data;
}

export async function getPipelineSummary(): Promise<PipelineSummary[]> {
  const response = await api.get<PipelineSummary[]>(
    "/api/v1/opportunities/pipeline-summary",
  );
  return response.data;
}
