import { z } from "zod/v4";

export const milestoneSchema = z.object({
  title: z.string().min(1, "Milestone title is required"),
  description: z.string().optional(),
  due_date: z.string().optional(),
  position: z.number().optional(),
});

export const programCreateSchema = z.object({
  client_id: z.uuid("Please select a client"),
  title: z.string().min(1, "Program title is required"),
  objectives: z.string().optional(),
  scope: z.string().optional(),
  budget_envelope: z.number().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  milestones: z.array(milestoneSchema).optional(),
});

export const programUpdateSchema = programCreateSchema.partial().extend({
  id: z.string(),
});

export const programFilterSchema = z.object({
  client_id: z.string().optional(),
  status: z.string().optional(),
  rag_status: z.enum(["red", "amber", "green"]).optional(),
  search: z.string().optional(),
});

export type ProgramCreateFormData = z.infer<typeof programCreateSchema>;
export type ProgramUpdateFormData = z.infer<typeof programUpdateSchema>;
export type ProgramFilterFormData = z.infer<typeof programFilterSchema>;
export type MilestoneFormData = z.infer<typeof milestoneSchema>;
