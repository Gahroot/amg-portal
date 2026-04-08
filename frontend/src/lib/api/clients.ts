import api from "@/lib/api";
import type {
  ClientProfile,
  ClientProfileListResponse,
  ClientProfileCreateData,
  ClientProfileUpdateData,
  ComplianceReviewData,
  DuplicateCheckRequest,
  DuplicateMatch,
  IntelligenceFile,
  MDApprovalData,
  ClientProvisionData,
  ComplianceCertificate,
  ClientPortalProfile,
  ClientListParams,
  SecurityBrief,
  SecurityProfileLevelUpdate,
  UpcomingDateItem,
} from "@/types/client";
import { createApiClient } from "./factory";

// Simplified client type for selection dropdowns
export interface Client {
  id: string;
  name: string;
}

const clientsApi = createApiClient<
  ClientProfile,
  ClientProfileListResponse,
  ClientProfileCreateData,
  ClientProfileUpdateData
>("/api/v1/clients/");

export const listClientProfiles = clientsApi.list as (
  params?: ClientListParams,
) => Promise<ClientProfileListResponse>;
export const getClientProfile = clientsApi.get;
export const createClientProfile = clientsApi.create;
export const updateClientProfile = clientsApi.update;

// Custom endpoints

export async function updateIntelligenceFile(
  id: string,
  data: IntelligenceFile
): Promise<ClientProfile> {
  const response = await api.patch<ClientProfile>(
    `/api/v1/clients/${id}/intelligence`,
    data
  );
  return response.data;
}

export async function submitComplianceReview(
  id: string,
  data: ComplianceReviewData
): Promise<ClientProfile> {
  const response = await api.post<ClientProfile>(
    `/api/v1/clients/${id}/compliance-review`,
    data
  );
  return response.data;
}

export async function getComplianceCertificate(
  id: string
): Promise<ComplianceCertificate> {
  const response = await api.get<ComplianceCertificate>(
    `/api/v1/clients/${id}/compliance-certificate`
  );
  return response.data;
}

export async function submitMDApproval(
  id: string,
  data: MDApprovalData
): Promise<ClientProfile> {
  const response = await api.post<ClientProfile>(
    `/api/v1/clients/${id}/md-approval`,
    data
  );
  return response.data;
}

export async function provisionClient(
  id: string,
  data: ClientProvisionData
): Promise<ClientProfile> {
  const response = await api.post<ClientProfile>(
    `/api/v1/clients/${id}/provision`,
    data
  );
  return response.data;
}

export async function getMyPortfolio(
  params?: { skip?: number; limit?: number }
): Promise<ClientProfileListResponse> {
  const response = await api.get<ClientProfileListResponse>(
    "/api/v1/clients/my-portfolio",
    { params }
  );
  return response.data;
}

export async function getPortalProfile(): Promise<ClientPortalProfile> {
  const response = await api.get<ClientPortalProfile>(
    "/api/v1/portal/profile"
  );
  return response.data;
}

export async function listClients(
  params?: ClientListParams
): Promise<{ clients: Client[] }> {
  const response = await listClientProfiles(params);
  return {
    clients: response.profiles.map((p) => ({
      id: p.id,
      name: p.display_name ?? p.legal_name,
    })),
  };
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

export async function checkClientDuplicates(
  data: DuplicateCheckRequest
): Promise<DuplicateMatch[]> {
  const response = await api.post<DuplicateMatch[]>(
    "/api/v1/clients/check-duplicates",
    data
  );
  return response.data;
}

// ---------------------------------------------------------------------------
// Security & Intelligence Feed — strictly need-to-know (MD + RM only)
// ---------------------------------------------------------------------------

export async function getSecurityBrief(id: string): Promise<SecurityBrief> {
  const response = await api.get<SecurityBrief>(
    `/api/v1/clients/${id}/security-brief`
  );
  return response.data;
}

// ---------------------------------------------------------------------------
// Client dates (birthdays & important dates)
// ---------------------------------------------------------------------------

export async function getUpcomingDates(params?: {
  days_ahead?: number;
}): Promise<UpcomingDateItem[]> {
  const response = await api.get<UpcomingDateItem[]>(
    "/api/v1/clients/upcoming-dates",
    { params }
  );
  return response.data;
}

export async function updateSecurityProfileLevel(
  id: string,
  data: SecurityProfileLevelUpdate
): Promise<{ profile_id: string; security_profile_level: string }> {
  const response = await api.patch<{
    profile_id: string;
    security_profile_level: string;
  }>(`/api/v1/clients/${id}/security-profile-level`, data);
  return response.data;
}
