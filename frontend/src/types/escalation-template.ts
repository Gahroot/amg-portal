/**
 * Escalation template types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/escalation_template.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type EscalationTemplate = components["schemas"]["EscalationTemplateResponse"];
export type EscalationTemplateListResponse = components["schemas"]["EscalationTemplateListResponse"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums, request shapes, constants
// ---------------------------------------------------------------------------

export type EscalationTemplateCategory =
  | "partner_sla_breach"
  | "client_dissatisfaction"
  | "resource_unavailable"
  | "budget_overrun"
  | "timeline_delay"
  | "quality_issue";

export type EscalationTemplateSeverity =
  | "task"
  | "milestone"
  | "program"
  | "client_impact";

export interface EscalationTemplateCreate {
  name: string;
  category: EscalationTemplateCategory;
  severity: EscalationTemplateSeverity;
  description_template?: string;
  suggested_actions?: string[];
  notification_template?: string;
  is_active?: boolean;
}

export interface EscalationTemplateUpdate {
  name?: string;
  category?: EscalationTemplateCategory;
  severity?: EscalationTemplateSeverity;
  description_template?: string;
  suggested_actions?: string[];
  notification_template?: string;
  is_active?: boolean;
}

export interface EscalationTemplateListParams {
  skip?: number;
  limit?: number;
  category?: EscalationTemplateCategory;
  severity?: EscalationTemplateSeverity;
  is_active?: boolean;
  is_system?: boolean;
}

export const CATEGORY_LABELS: Record<EscalationTemplateCategory, string> = {
  partner_sla_breach: "Partner SLA Breach",
  client_dissatisfaction: "Client Dissatisfaction",
  resource_unavailable: "Resource Unavailable",
  budget_overrun: "Budget Overrun",
  timeline_delay: "Timeline Delay",
  quality_issue: "Quality Issue",
};

export const SEVERITY_LABELS: Record<EscalationTemplateSeverity, string> = {
  task: "Task",
  milestone: "Milestone",
  program: "Program",
  client_impact: "Client Impact",
};
