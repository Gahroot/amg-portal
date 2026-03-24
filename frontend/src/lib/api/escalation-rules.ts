import api from "@/lib/api";
import type {
  EscalationChainResponse,
  EscalationRule,
  EscalationRuleCreate,
  EscalationRuleListParams,
  EscalationRuleListResponse,
  EscalationRuleUpdate,
} from "@/types/escalation-rule";
import type { Escalation } from "@/types/escalation";

export async function listEscalationRules(
  params?: EscalationRuleListParams,
): Promise<EscalationRuleListResponse> {
  const response = await api.get<EscalationRuleListResponse>(
    "/api/v1/escalations/escalation-rules",
    { params },
  );
  return response.data;
}

export async function getEscalationRule(
  id: string,
): Promise<EscalationRule> {
  const response = await api.get<EscalationRule>(
    `/api/v1/escalations/escalation-rules/${id}`,
  );
  return response.data;
}

export async function createEscalationRule(
  data: EscalationRuleCreate,
): Promise<EscalationRule> {
  const response = await api.post<EscalationRule>(
    "/api/v1/escalations/escalation-rules",
    data,
  );
  return response.data;
}

export async function updateEscalationRule(
  id: string,
  data: EscalationRuleUpdate,
): Promise<EscalationRule> {
  const response = await api.put<EscalationRule>(
    `/api/v1/escalations/escalation-rules/${id}`,
    data,
  );
  return response.data;
}

export async function deleteEscalationRule(
  id: string,
): Promise<void> {
  await api.delete(`/api/v1/escalations/escalation-rules/${id}`);
}

export async function progressEscalation(
  id: string,
  notes?: string,
): Promise<Escalation> {
  const response = await api.post<Escalation>(
    `/api/v1/escalations/${id}/progress`,
    { notes },
  );
  return response.data;
}

export async function getEscalationChain(
  id: string,
): Promise<EscalationChainResponse> {
  const response = await api.get<EscalationChainResponse>(
    `/api/v1/escalations/${id}/chain`,
  );
  return response.data;
}
