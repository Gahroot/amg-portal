import api from "@/lib/api";
import type {
  ClientProfile,
  ClientProfileListResponse,
  ClientProfileCreateData,
  ClientProfileUpdateData,
  ComplianceReviewData,
  MDApprovalData,
  ClientProvisionData,
  ComplianceCertificate,
  ClientPortalProfile,
  ClientListParams,
  PortalProgramListResponse,
  PortalProgramDetail,
} from "@/types/client";
import type { DecisionListResponse, DecisionRequest, DecisionResponseData } from "@/types/communication";

export type { ClientProfile } from "@/types/client";

export async function listClientProfiles(
  params?: ClientListParams
): Promise<ClientProfileListResponse> {
  const response = await api.get<ClientProfileListResponse>(
    "/api/v1/clients/",
    { params }
  );
  return response.data;
}

export async function getClientProfile(id: string): Promise<ClientProfile> {
  const response = await api.get<ClientProfile>(`/api/v1/clients/${id}`);
  return response.data;
}

export async function createClientProfile(
  data: ClientProfileCreateData
): Promise<ClientProfile> {
  const response = await api.post<ClientProfile>("/api/v1/clients/", data);
  return response.data;
}

export async function updateClientProfile(
  id: string,
  data: ClientProfileUpdateData
): Promise<ClientProfile> {
  const response = await api.patch<ClientProfile>(
    `/api/v1/clients/${id}`,
    data
  );
  return response.data;
}

export async function updateIntelligenceFile(
  id: string,
  data: Record<string, unknown>
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

// --- Portal Programs ---

export async function getPortalPrograms(): Promise<PortalProgramListResponse> {
  const response = await api.get<PortalProgramListResponse>(
    "/api/v1/portal/programs"
  );
  return response.data;
}

export async function getPortalProgramDetail(
  id: string
): Promise<PortalProgramDetail> {
  const response = await api.get<PortalProgramDetail>(
    `/api/v1/portal/programs/${id}`
  );
  return response.data;
}

// --- Portal Decisions ---

export async function getPortalDecisions(params?: {
  status?: string;
  skip?: number;
  limit?: number;
}): Promise<DecisionListResponse> {
  const response = await api.get<DecisionListResponse>(
    "/api/v1/portal/decisions",
    { params }
  );
  return response.data;
}

export async function respondToPortalDecision(
  id: string,
  data: DecisionResponseData
): Promise<DecisionRequest> {
  const response = await api.post<DecisionRequest>(
    `/api/v1/portal/decisions/${id}/respond`,
    { response: data }
  );
  return response.data;
}
