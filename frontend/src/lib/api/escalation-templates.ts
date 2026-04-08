import type {
  EscalationTemplate,
  EscalationTemplateCreate,
  EscalationTemplateListParams,
  EscalationTemplateListResponse,
  EscalationTemplateUpdate,
} from "@/types/escalation-template";
import { createApiClient } from "./factory";

const templatesApi = createApiClient<
  EscalationTemplate,
  EscalationTemplateListResponse,
  EscalationTemplateCreate,
  EscalationTemplateUpdate
>("/api/v1/escalation-templates/", { updateMethod: "put" });

export const listEscalationTemplates = templatesApi.list as (
  params?: EscalationTemplateListParams,
) => Promise<EscalationTemplateListResponse>;
export const getEscalationTemplate = templatesApi.get;
export const createEscalationTemplate = templatesApi.create;
export const updateEscalationTemplate = templatesApi.update;
export const deleteEscalationTemplate = templatesApi.delete;
