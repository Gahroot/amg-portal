import { z } from "zod/v4";

// Communication log channel enum
export const communicationChannelSchema = z.enum([
  "email",
  "phone",
  "video_call",
  "in_person",
  "letter",
]);

// Communication log direction enum
export const communicationDirectionSchema = z.enum(["inbound", "outbound"]);

// Communication log form schema
export const communicationLogSchema = z.object({
  channel: communicationChannelSchema,
  direction: communicationDirectionSchema,
  subject: z.string().min(1, "Subject is required"),
  summary: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().optional(),
  occurred_at: z.string().min(1, "Date and time is required"),
  tags: z.array(z.string()).optional(),
});

// Decision response type enum
export const decisionResponseTypeSchema = z.enum([
  "text",
  "yes_no",
  "choice",
  "multi_choice",
]);

// Decision response schema
export const decisionResponseSchema = z.object({
  option_id: z.string().optional(),
  text: z.string().optional(),
});

// Decision request schema (for creating decisions)
export const decisionRequestSchema = z.object({
  title: z.string().min(1, "Title is required"),
  prompt: z.string().min(1, "Prompt is required"),
  response_type: decisionResponseTypeSchema,
  options: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),
  deadline: z.string().optional(),
  consequence_text: z.string().optional(),
  client_id: z.string().optional(),
  program_id: z.string().optional(),
});

// Message compose schema
export const messageComposeSchema = z.object({
  content: z.string().min(1, "Message content is required"),
  recipients: z.array(z.string()).min(1, "At least one recipient is required"),
  subject: z.string().optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
  attachments: z.array(z.string()).optional(),
});

// Template compose schema
export const templateComposeSchema = z.object({
  template_id: z.string().min(1, "Template is required"),
  variables: z.record(z.string(), z.string()).optional(),
  recipients: z.array(z.string()).min(1, "At least one recipient is required"),
});

// Type exports
export type CommunicationChannel = z.infer<typeof communicationChannelSchema>;
export type CommunicationDirection = z.infer<typeof communicationDirectionSchema>;
export type CommunicationLogFormData = z.infer<typeof communicationLogSchema>;
export type DecisionResponseType = z.infer<typeof decisionResponseTypeSchema>;
export type DecisionResponseFormData = z.infer<typeof decisionResponseSchema>;
export type DecisionRequestFormData = z.infer<typeof decisionRequestSchema>;
export type MessageComposeFormData = z.infer<typeof messageComposeSchema>;
export type TemplateComposeFormData = z.infer<typeof templateComposeSchema>;
