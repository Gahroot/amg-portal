import api from "@/lib/api";
import type {
  AccessAudit,
  AccessAuditListResponse,
  AccessAuditStatistics,
  AccessAuditFinding,
  AccessAuditFindingListResponse,
  CreateAccessAuditRequest,
  UpdateAccessAuditRequest,
  CreateAccessAuditFindingRequest,
  UpdateAccessAuditFindingRequest,
  RemediateFindingRequest,
  WaiveFindingRequest,
  AccessAuditListParams,
  AuditFindingListParams,
} from "@/types/access-audit";
import { createApiClient } from "./factory";

const auditsApi = createApiClient<
  AccessAudit,
  AccessAuditListResponse,
  CreateAccessAuditRequest,
  UpdateAccessAuditRequest
>("/api/v1/access-audits/", { updateMethod: "put" });

export const listAccessAudits = auditsApi.list as (
  params?: AccessAuditListParams,
) => Promise<AccessAuditListResponse>;
export const getAccessAudit = auditsApi.get;
export const createAccessAudit = auditsApi.create;
export const updateAccessAudit = auditsApi.update;

// Custom endpoints

export async function completeAccessAudit(id: string): Promise<AccessAudit> {
  const response = await api.post<AccessAudit>(
    `/api/v1/access-audits/${id}/complete`
  );
  return response.data;
}

export async function getAccessAuditStatistics(): Promise<AccessAuditStatistics> {
  const response = await api.get<AccessAuditStatistics>(
    "/api/v1/access-audits/statistics"
  );
  return response.data;
}

export async function getCurrentQuarterAudit(): Promise<AccessAudit | null> {
  const response = await api.get<AccessAudit | null>(
    "/api/v1/access-audits/current"
  );
  return response.data;
}

export async function listAuditFindings(
  params?: AuditFindingListParams
): Promise<AccessAuditFindingListResponse> {
  const response = await api.get<AccessAuditFindingListResponse>(
    "/api/v1/access-audits/findings",
    { params }
  );
  return response.data;
}

export async function createAuditFinding(
  auditId: string,
  data: CreateAccessAuditFindingRequest
): Promise<AccessAuditFinding> {
  const response = await api.post<AccessAuditFinding>(
    `/api/v1/access-audits/${auditId}/findings`,
    data
  );
  return response.data;
}

export async function updateAuditFinding(
  findingId: string,
  data: UpdateAccessAuditFindingRequest
): Promise<AccessAuditFinding> {
  const response = await api.put<AccessAuditFinding>(
    `/api/v1/access-audits/findings/${findingId}`,
    data
  );
  return response.data;
}

export async function acknowledgeFinding(
  findingId: string,
  data?: { notes?: string }
): Promise<AccessAuditFinding> {
  const response = await api.post<AccessAuditFinding>(
    `/api/v1/access-audits/findings/${findingId}/acknowledge`,
    data || {}
  );
  return response.data;
}

export async function remediateFinding(
  findingId: string,
  data: RemediateFindingRequest
): Promise<AccessAuditFinding> {
  const response = await api.post<AccessAuditFinding>(
    `/api/v1/access-audits/findings/${findingId}/remediate`,
    data
  );
  return response.data;
}

export async function waiveFinding(
  findingId: string,
  data: WaiveFindingRequest
): Promise<AccessAuditFinding> {
  const response = await api.post<AccessAuditFinding>(
    `/api/v1/access-audits/findings/${findingId}/waive`,
    data
  );
  return response.data;
}
