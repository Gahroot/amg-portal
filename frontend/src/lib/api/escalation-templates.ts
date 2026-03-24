import api from "@/lib/api";
import type {
  EscalationTemplate,
  EscalationTemplateCreate,
  EscalationTemplateListParams,
  EscalationTemplateListResponse,
  EscalationTemplateUpdate,
} from "@/types/escalation-template";

export async function listEscalationTemplates(
  params?: EscalationTemplateListParams,
): Promise<EscalationTemplateListResponse> {
  const response = await api.get<EscalationTemplateListResponse>(
    "/api/v1/escalation-templates/",
    { params },
  );
  return response.data;
}

export async function getEscalationTemplate(
  id: string,
): Promise<EscalationTemplate> {
  const response = await api.get<EscalationTemplate>(
    `/api/v1/escalation-templates/${id}`,
  );
  return response.data;
}

export async function createEscalationTemplate(
  data: EscalationTemplateCreate,
): Promise<EscalationTemplate> {
  const response = await api.post<EscalationTemplate>(
    "/api/v1/escalation-templates/",
    data,
  );
  return response.data;
}

export async function updateEscalationTemplate(
  id: string,
  data: EscalationTemplateUpdate,
): Promise<EscalationTemplate> {
  const response = await api.put<EscalationTemplate>(
    `/api/v1/escalation-templates/${id}`,
    data,
  );
  return response.data;
}

export async function deleteEscalationTemplate(id: string): Promise<void> {
  await api.delete(`/api/v1/escalation-templates/${id}`);
}
