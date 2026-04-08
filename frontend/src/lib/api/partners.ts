import api from "@/lib/api";
import type {
  AllPartnersCapacitySummary,
  BlockedDate,
  BlockedDateCreate,
  PartnerCapacityHeatmap,
  PartnerComparisonResponse,
  PartnerProfile,
  PartnerListResponse,
  PartnerListParams,
  PartnerCreateData,
  PartnerUpdateData,
  PartnerProvisionData,
  PartnerTrends,
  PartnerDuplicateCheckRequest,
  PartnerDuplicateMatch,
  RefreshDuePartnerListResponse,
} from "@/types/partner";
import { createApiClient } from "./factory";

// Re-export types for convenience
export type {
  AllPartnersCapacitySummary,
  BlockedDate,
  BlockedDateCreate,
  PartnerCapacityHeatmap,
  PartnerComparisonResponse,
  PartnerProfile,
  PartnerListResponse,
  PartnerListParams,
  PartnerCreateData,
  PartnerUpdateData,
  PartnerProvisionData,
  PartnerTrends,
  RefreshDuePartnerListResponse,
};

const partnersApi = createApiClient<
  PartnerProfile,
  PartnerListResponse,
  PartnerCreateData,
  PartnerUpdateData
>("/api/v1/partners/");

export const listPartners = partnersApi.list as (params?: PartnerListParams) => Promise<PartnerListResponse>;
export const getPartner = partnersApi.get;
export const createPartner = partnersApi.create;
export const updatePartner = partnersApi.update;

// Custom endpoints

export async function provisionPartner(id: string, data: PartnerProvisionData): Promise<PartnerProfile> {
  const response = await api.post<PartnerProfile>(`/api/v1/partners/${id}/provision`, data);
  return response.data;
}

export async function uploadComplianceDoc(id: string, file: File): Promise<PartnerProfile> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<PartnerProfile>(`/api/v1/partners/${id}/compliance-doc`, formData);
  return response.data;
}

export async function getRefreshDuePartners(
  includeDueSoon = true
): Promise<RefreshDuePartnerListResponse> {
  const response = await api.get<RefreshDuePartnerListResponse>(
    "/api/v1/partners/refresh-due",
    { params: { include_due_soon: includeDueSoon } }
  );
  return response.data;
}

export async function comparePartners(
  ids: string[]
): Promise<PartnerComparisonResponse> {
  const response = await api.get<PartnerComparisonResponse>(
    "/api/v1/partners/compare",
    { params: { ids: ids.join(",") } }
  );
  return response.data;
}

export async function getPartnerTrends(
  partnerId: string,
  days = 90
): Promise<PartnerTrends> {
  const response = await api.get<PartnerTrends>(
    `/api/v1/partners/${partnerId}/trends`,
    { params: { days } }
  );
  return response.data;
}

export async function getMyTrends(days = 90): Promise<PartnerTrends> {
  const response = await api.get<PartnerTrends>(
    "/api/v1/partner-portal/trends",
    { params: { days } }
  );
  return response.data;
}

// ── Capacity / Heatmap ────────────────────────────────────────────────────────

export async function getPartnerCapacityHeatmap(
  partnerId: string,
  startDate?: string,
  endDate?: string,
): Promise<PartnerCapacityHeatmap> {
  const response = await api.get<PartnerCapacityHeatmap>(
    `/api/v1/partners/${partnerId}/capacity`,
    { params: { start_date: startDate, end_date: endDate } },
  );
  return response.data;
}

export async function getAllPartnersCapacitySummary(
  targetDate?: string,
): Promise<AllPartnersCapacitySummary> {
  const response = await api.get<AllPartnersCapacitySummary>(
    "/api/v1/partners/capacity/summary",
    { params: { target_date: targetDate } },
  );
  return response.data;
}

export async function getPartnerBlockedDates(
  partnerId: string,
  startDate?: string,
  endDate?: string,
): Promise<BlockedDate[]> {
  const response = await api.get<BlockedDate[]>(
    `/api/v1/partners/${partnerId}/blocked-dates`,
    { params: { start_date: startDate, end_date: endDate } },
  );
  return response.data;
}

export async function addBlockedDate(
  partnerId: string,
  data: BlockedDateCreate,
): Promise<BlockedDate> {
  const response = await api.post<BlockedDate>(
    `/api/v1/partners/${partnerId}/blocked-dates`,
    data,
  );
  return response.data;
}

export async function removeBlockedDate(
  partnerId: string,
  blockedDateId: string,
): Promise<void> {
  await api.delete(`/api/v1/partners/${partnerId}/blocked-dates/${blockedDateId}`);
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

export async function checkPartnerDuplicates(
  data: PartnerDuplicateCheckRequest
): Promise<PartnerDuplicateMatch[]> {
  const response = await api.post<PartnerDuplicateMatch[]>(
    "/api/v1/partners/check-duplicates",
    data
  );
  return response.data;
}
