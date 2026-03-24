import api from "@/lib/api";

export interface DeliverableTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  file_type: string | null;
  file_name: string | null;
  file_size: number | null;
  deliverable_type: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  download_url: string | null;
}

export interface DeliverableTemplateListResponse {
  templates: DeliverableTemplate[];
  total: number;
}

export interface TemplateCategoryInfo {
  key: string;
  label: string;
  count: number;
}

export interface ListTemplatesParams {
  category?: string;
  deliverable_type?: string;
  search?: string;
  skip?: number;
  limit?: number;
}

export interface SuggestTemplatesParams {
  deliverable_type?: string;
  assignment_title?: string;
  limit?: number;
}

export interface TemplateDownloadUrl {
  template_id: string;
  download_url: string;
  file_name: string | null;
  file_type: string | null;
}

export async function listDeliverableTemplates(
  params?: ListTemplatesParams
): Promise<DeliverableTemplateListResponse> {
  const response = await api.get<DeliverableTemplateListResponse>(
    "/api/v1/deliverable-templates/",
    { params }
  );
  return response.data;
}

export async function getTemplateCategories(): Promise<TemplateCategoryInfo[]> {
  const response = await api.get<TemplateCategoryInfo[]>(
    "/api/v1/deliverable-templates/categories"
  );
  return response.data;
}

export async function suggestTemplates(
  params?: SuggestTemplatesParams
): Promise<DeliverableTemplateListResponse> {
  const response = await api.get<DeliverableTemplateListResponse>(
    "/api/v1/deliverable-templates/suggest",
    { params }
  );
  return response.data;
}

export async function getDeliverableTemplate(
  id: string
): Promise<DeliverableTemplate> {
  const response = await api.get<DeliverableTemplate>(
    `/api/v1/deliverable-templates/${id}`
  );
  return response.data;
}

export async function getTemplateDownloadUrl(
  id: string
): Promise<TemplateDownloadUrl> {
  const response = await api.get<TemplateDownloadUrl>(
    `/api/v1/deliverable-templates/${id}/download-url`
  );
  return response.data;
}
