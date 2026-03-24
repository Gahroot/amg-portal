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

export interface EscalationChainResponse {
  escalation_id: string;
  current_level: string;
  chain: Record<string, unknown>[];
  total_entries: number;
}

export interface EscalationRuleListParams {
  skip?: number;
  limit?: number;
  is_active?: boolean;
  trigger_type?: string;
}
