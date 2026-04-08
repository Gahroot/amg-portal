import type {
  CommunicationLog,
  CommunicationLogListResponse,
  CommunicationLogCreateData,
  CommunicationLogUpdateData,
  CommunicationLogListParams,
} from "@/types/communication-log";
import { createApiClient } from "./factory";

const logsApi = createApiClient<
  CommunicationLog,
  CommunicationLogListResponse,
  CommunicationLogCreateData,
  CommunicationLogUpdateData
>("/api/v1/communication-logs/", { updateMethod: "put" });

export const listCommunicationLogs = logsApi.list as (
  params?: CommunicationLogListParams,
) => Promise<CommunicationLogListResponse>;
export const getCommunicationLog = logsApi.get;
export const createCommunicationLog = logsApi.create;
export const updateCommunicationLog = logsApi.update;
export const deleteCommunicationLog = logsApi.delete;
