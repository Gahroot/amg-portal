import api from "@/lib/api";
import type {
  CommunicationLog,
  CommunicationLogListResponse,
  CommunicationLogCreateData,
  CommunicationLogUpdateData,
  CommunicationLogListParams,
} from "@/types/communication-log";

export async function listCommunicationLogs(
  params?: CommunicationLogListParams
): Promise<CommunicationLogListResponse> {
  const response = await api.get<CommunicationLogListResponse>(
    "/api/v1/communication-logs/",
    { params }
  );
  return response.data;
}

export async function getCommunicationLog(id: string): Promise<CommunicationLog> {
  const response = await api.get<CommunicationLog>(
    `/api/v1/communication-logs/${id}`
  );
  return response.data;
}

export async function createCommunicationLog(
  data: CommunicationLogCreateData
): Promise<CommunicationLog> {
  const response = await api.post<CommunicationLog>(
    "/api/v1/communication-logs/",
    data
  );
  return response.data;
}

export async function updateCommunicationLog(
  id: string,
  data: CommunicationLogUpdateData
): Promise<CommunicationLog> {
  const response = await api.put<CommunicationLog>(
    `/api/v1/communication-logs/${id}`,
    data
  );
  return response.data;
}

export async function deleteCommunicationLog(id: string): Promise<void> {
  await api.delete(`/api/v1/communication-logs/${id}`);
}
