import api from "@/lib/api";
import { createApiClient } from "./factory";
import type {
  Lead,
  LeadCreateData,
  LeadConvertRequest,
  LeadListParams,
  LeadListResponse,
  LeadUpdateData,
} from "@/types/crm";

const leadsApi = createApiClient<Lead, LeadListResponse, LeadCreateData, LeadUpdateData>(
  "/api/v1/leads/",
);

export const listLeads = leadsApi.list as (
  params?: LeadListParams,
) => Promise<LeadListResponse>;
export const getLead = leadsApi.get;
export const createLead = leadsApi.create;
export const updateLead = leadsApi.update;
export const deleteLead = leadsApi.delete;

export async function convertLead(
  id: string,
  data: LeadConvertRequest,
): Promise<Lead> {
  const response = await api.post<Lead>(`/api/v1/leads/${id}/convert`, data);
  return response.data;
}
