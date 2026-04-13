import { createApiClient } from "./factory";
import type {
  CrmActivity,
  CrmActivityCreateData,
  CrmActivityListResponse,
  CrmActivityUpdateData,
} from "@/types/crm";

const crmActivitiesApi = createApiClient<
  CrmActivity,
  CrmActivityListResponse,
  CrmActivityCreateData,
  CrmActivityUpdateData
>("/api/v1/crm-activities/");

export interface CrmActivityListParams {
  lead_id?: string;
  opportunity_id?: string;
  client_profile_id?: string;
  skip?: number;
  limit?: number;
}

export const listCrmActivities = crmActivitiesApi.list as (
  params?: CrmActivityListParams,
) => Promise<CrmActivityListResponse>;
export const createCrmActivity = crmActivitiesApi.create;
export const updateCrmActivity = crmActivitiesApi.update;
export const deleteCrmActivity = crmActivitiesApi.delete;
