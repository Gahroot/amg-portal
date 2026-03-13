import api from "@/lib/api";
import type {
  KYCAlert,
  KYCAlertListResponse,
  KYCAlertListParams,
  KYCAlertResolveRequest,
} from "@/types/kyc-alert";

export async function listKYCAlerts(
  params?: KYCAlertListParams,
): Promise<KYCAlertListResponse> {
  const response = await api.get<KYCAlertListResponse>(
    "/api/v1/kyc/alerts",
    { params },
  );
  return response.data;
}

export async function getKYCAlert(id: string): Promise<KYCAlert> {
  const response = await api.get<KYCAlert>(`/api/v1/kyc/alerts/${id}`);
  return response.data;
}

export async function markKYCAlertRead(id: string): Promise<KYCAlert> {
  const response = await api.patch<KYCAlert>(
    `/api/v1/kyc/alerts/${id}/read`,
  );
  return response.data;
}

export async function resolveKYCAlert(
  id: string,
  data?: KYCAlertResolveRequest,
): Promise<KYCAlert> {
  const response = await api.post<KYCAlert>(
    `/api/v1/kyc/alerts/${id}/resolve`,
    data ?? {},
  );
  return response.data;
}
