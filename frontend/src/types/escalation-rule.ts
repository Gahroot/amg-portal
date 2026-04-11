/**
 * Escalation rule types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/escalation.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type EscalationChainResponse = components["schemas"]["EscalationChainResponse"];
export type EscalationRule = components["schemas"]["EscalationRuleResponse"];
export type EscalationRuleListResponse = components["schemas"]["EscalationRuleListResponse"];
export type EscalationRuleCreate = components["schemas"]["EscalationRuleCreate"];
export type EscalationRuleUpdate = components["schemas"]["EscalationRuleUpdate"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums, display helpers, query params
// ---------------------------------------------------------------------------

export type EscalationTriggerType =
  | "sla_breach"
  | "milestone_overdue"
  | "budget_exceeded"
  | "task_overdue"
  | "manual";

export interface EscalationChainEntry {
  action: string;
  at: string;
  by?: string;
  level?: string;
  notes?: string;
  from_level?: string;
  to_level?: string;
}

export interface EscalationRuleListParams {
  skip?: number;
  limit?: number;
  is_active?: boolean;
  trigger_type?: string;
}
