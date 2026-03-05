import api from "@/lib/api";
import type {
  CommunicationTemplate,
  TemplateListResponse,
  TemplateCreateData,
  TemplateRenderRequest,
  TemplateRenderResponse,
} from "@/types/communication";

export interface TemplateListParams {
  template_type?: string;
  skip?: number;
  limit?: number;
}

// Templates
export async function listTemplates(
  params?: TemplateListParams
): Promise<TemplateListResponse> {
  const response = await api.get<TemplateListResponse>(
    "/api/v1/communication-templates/",
    { params }
  );
  return response.data;
}

export async function getTemplate(id: string): Promise<CommunicationTemplate> {
  const response = await api.get<CommunicationTemplate>(
    `/api/v1/communication-templates/${id}`
  );
  return response.data;
}

export async function createTemplate(
  data: TemplateCreateData
): Promise<CommunicationTemplate> {
  const response = await api.post<CommunicationTemplate>(
    "/api/v1/communication-templates/",
    data
  );
  return response.data;
}

export async function updateTemplate(
  id: string,
  data: Partial<TemplateCreateData>
): Promise<CommunicationTemplate> {
  const response = await api.patch<CommunicationTemplate>(
    `/api/v1/communication-templates/${id}`,
    data
  );
  return response.data;
}

export async function renderTemplate(
  data: TemplateRenderRequest
): Promise<TemplateRenderResponse> {
  const response = await api.post<TemplateRenderResponse>(
    "/api/v1/communication-templates/render",
    data
  );
  return response.data;
}
