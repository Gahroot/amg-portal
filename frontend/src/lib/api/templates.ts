import api from "@/lib/api";
import type {
  Communication,
  CommunicationTemplate,
  SendFromTemplateRequest,
  TemplateCreateData,
  TemplateListResponse,
  TemplatePreviewRequest,
  TemplatePreviewResponse,
  TemplateRenderRequest,
  TemplateRenderResponse,
  TemplateStatusActionData,
} from "@/types/communication";

export interface TemplateListParams {
  template_type?: string;
  include_inactive?: boolean;
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

export async function deleteTemplate(id: string): Promise<void> {
  await api.delete(`/api/v1/communication-templates/${id}`);
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

export async function previewTemplate(
  data: TemplatePreviewRequest
): Promise<TemplatePreviewResponse> {
  const response = await api.post<TemplatePreviewResponse>(
    "/api/v1/communications/preview",
    data
  );
  return response.data;
}

export async function sendFromTemplate(
  data: SendFromTemplateRequest
): Promise<Communication> {
  const response = await api.post<Communication>(
    "/api/v1/communications/send-from-template",
    data
  );
  return response.data;
}

export async function updateTemplateStatus(
  id: string,
  data: TemplateStatusActionData
): Promise<CommunicationTemplate> {
  const response = await api.patch<CommunicationTemplate>(
    `/api/v1/communication-templates/${id}/status`,
    data
  );
  return response.data;
}
