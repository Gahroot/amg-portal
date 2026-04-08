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

// ---------------------------------------------------------------------------
// Frontend-only types — enums, request shapes, query params
// ---------------------------------------------------------------------------

export type EscalationTriggerType =
  | "sla_breach"
  | "milestone_overdue"
  | "budget_exceeded"
  | "task_overdue"
  | "manual";

export interface EscalationRule {
  id: string;
  name: string;
  description: string | null;
  trigger_type: EscalationTriggerType;
  trigger_conditions: Record<string, unknown>;
  escalation_level: string;
  auto_assign_to_role: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EscalationRuleListResponse {
  rules: EscalationRule[];
  total: number;
}

export interface EscalationRuleCreate {
  name: string;
  description?: string;
  trigger_type: EscalationTriggerType;
  trigger_conditions: Record<string, unknown>;
  escalation_level: string;
  auto_assign_to_role?: string;
  is_active?: boolean;
}

export interface EscalationRuleUpdate {
  name?: string;
  description?: string;
  trigger_type?: EscalationTriggerType;
  trigger_conditions?: Record<string, unknown>;
  escalation_level?: string;
  auto_assign_to_role?: string;
  is_active?: boolean;
}

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
