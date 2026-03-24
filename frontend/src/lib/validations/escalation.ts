import { z } from "zod/v4";

// Escalation trigger type enum
export const escalationTriggerTypeSchema = z.enum([
  "sla_breach",
  "milestone_overdue",
  "budget_exceeded",
  "task_overdue",
  "manual",
]);

// Escalation level enum
export const escalationLevelSchema = z.enum([
  "task",
  "milestone",
  "program",
  "client_impact",
]);

// Role enum for auto-assignment
export const escalationRoleSchema = z.enum([
  "managing_director",
  "relationship_manager",
  "coordinator",
  "finance_compliance",
]);

// Escalation rule form schema
export const escalationRuleSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  trigger_type: escalationTriggerTypeSchema,
  trigger_conditions: z.record(z.string(), z.unknown()).optional(),
  escalation_level: escalationLevelSchema,
  auto_assign_to_role: escalationRoleSchema.optional(),
  is_active: z.boolean(),
});

// Escalation rule create schema
export const escalationRuleCreateSchema = escalationRuleSchema;

// Escalation rule update schema
export const escalationRuleUpdateSchema = escalationRuleSchema.partial();

// Acknowledge escalation schema
export const acknowledgeEscalationSchema = z.object({
  notes: z.string().optional(),
  action_taken: z.string().optional(),
});

// Resolve escalation schema
export const resolveEscalationSchema = z.object({
  resolution_notes: z.string().min(1, "Resolution notes are required"),
  resolution_type: z.enum(["resolved", "escalated", "dismissed", "false_positive"]),
});

// Type exports
export type EscalationTriggerType = z.infer<typeof escalationTriggerTypeSchema>;
export type EscalationLevel = z.infer<typeof escalationLevelSchema>;
export type EscalationRole = z.infer<typeof escalationRoleSchema>;
export type EscalationRuleFormData = z.infer<typeof escalationRuleSchema>;
export type EscalationRuleCreateFormData = z.infer<typeof escalationRuleCreateSchema>;
export type EscalationRuleUpdateFormData = z.infer<typeof escalationRuleUpdateSchema>;
export type AcknowledgeEscalationFormData = z.infer<typeof acknowledgeEscalationSchema>;
export type ResolveEscalationFormData = z.infer<typeof resolveEscalationSchema>;
