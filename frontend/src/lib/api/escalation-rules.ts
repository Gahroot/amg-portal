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
import { createApiClient } from "./factory";

const rulesApi = createApiClient<
  EscalationRule,
  EscalationRuleListResponse,
  EscalationRuleCreate,
  EscalationRuleUpdate
>("/api/v1/escalations/escalation-rules", { updateMethod: "put" });

export const listEscalationRules = rulesApi.list as (
  params?: EscalationRuleListParams,
) => Promise<EscalationRuleListResponse>;
export const getEscalationRule = rulesApi.get;
export const createEscalationRule = rulesApi.create;
export const updateEscalationRule = rulesApi.update;
export const deleteEscalationRule = rulesApi.delete;

// Custom endpoints

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
