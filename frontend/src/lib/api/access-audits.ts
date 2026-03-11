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

export async function listAccessAudits(
  params?: AccessAuditListParams
): Promise<AccessAuditListResponse> {
  const response = await api.get<AccessAuditListResponse>(
    "/api/v1/access-audits/",
    { params }
  );
  return response.data;
}

export async function getAccessAudit(id: string): Promise<AccessAudit> {
  const response = await api.get<AccessAudit>(
    `/api/v1/access-audits/${id}`
  );
  return response.data;
}

export async function createAccessAudit(
  data: CreateAccessAuditRequest
): Promise<AccessAudit> {
  const response = await api.post<AccessAudit>(
    "/api/v1/access-audits/",
    data
  );
  return response.data;
}

export async function updateAccessAudit(
  id: string,
  data: UpdateAccessAuditRequest
): Promise<AccessAudit> {
  const response = await api.put<AccessAudit>(
    `/api/v1/access-audits/${id}`,
    data
  );
  return response.data;
}

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
