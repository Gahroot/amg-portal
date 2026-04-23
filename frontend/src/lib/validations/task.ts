import { z } from "zod/v4";

// Task priority enum
export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

// Task status enum
export const taskStatusSchema = z.enum(["todo", "in_progress", "blocked", "done", "cancelled"]);

// Task form schema (for create/edit dialogs)
export const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title must be 255 characters or less"),
  description: z.string().max(2000, "Description must be 2000 characters or less").optional(),
  milestone_id: z.string().min(1, "Milestone is required"),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  due_date: z.string().optional(),
  assigned_to: z.string().optional().nullable(),
});

// Task create schema (simpler version from program.ts)
export const taskCreateSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  description: z.string().optional(),
  due_date: z.string().optional(),
  assigned_to: z.string().optional(),
  priority: taskPrioritySchema.optional(),
});

// Task update schema
export const taskUpdateSchema = taskFormSchema.partial();

// Task filter schema
export const taskFilterSchema = z.object({
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assigned_to: z.string().optional(),
  milestone_id: z.string().optional(),
  due_date_from: z.string().optional(),
  due_date_to: z.string().optional(),
  search: z.string().optional(),
});

// Quick task dialog schema (includes program_id for program selection)
export const quickTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title must be 255 characters or less"),
  description: z.string().max(2000, "Description must be 2000 characters or less").optional(),
  program_id: z.string().min(1, "Program is required"),
  milestone_id: z.string().min(1, "Milestone is required"),
  due_date: z.string().optional(),
  assigned_to: z.string().optional().nullable(),
  priority: taskPrioritySchema.default("medium"),
});

// Type exports
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskFormData = z.infer<typeof taskFormSchema>;
export type TaskCreateFormData = z.infer<typeof taskCreateSchema>;
export type TaskUpdateFormData = z.infer<typeof taskUpdateSchema>;
export type TaskFilterFormData = z.infer<typeof taskFilterSchema>;
export type QuickTaskFormData = z.infer<typeof quickTaskSchema>;
