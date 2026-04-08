/**
 * Task board types — re-exported from generated OpenAPI types where possible.
 *
 * API types are sourced from generated.ts (auto-generated from FastAPI OpenAPI schema).
 * Frontend-only types (UI constants, display helpers) remain manual.
 *
 * To refresh: npm run generate:types (requires backend at localhost:8000)
 *
 * @see backend/app/schemas/task.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type TaskStatus = components["schemas"]["TaskStatus"];
export type TaskPriority = components["schemas"]["TaskPriority"];
export type AssigneeInfo = components["schemas"]["AssigneeInfo"];
export type ProgramInfo = components["schemas"]["ProgramInfo"];
export type MilestoneInfo = components["schemas"]["MilestoneInfo"];
export type TaskBoard = components["schemas"]["TaskBoardResponse"];
export type TaskBoardListResponse = components["schemas"]["TaskBoardListResponse"];
export type TaskCreate = components["schemas"]["TaskBoardCreate"];
export type TaskUpdate = components["schemas"]["TaskBoardUpdate"];
export type TaskReorder = components["schemas"]["TaskReorder"];
export type TaskBulkUpdateResult = components["schemas"]["TaskBulkUpdateResult"];

// ---------------------------------------------------------------------------
// Frontend-only types — payload shapes, UI constants
// ---------------------------------------------------------------------------

export interface TaskBulkUpdatePayload {
  task_ids: string[];
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  clear_due_date?: boolean;
  assigned_to?: string;
  clear_assignee?: boolean;
  delete?: boolean;
}

export interface BulkUpdateFailure {
  task_id: string;
  error: string;
}

export const TASK_STATUSES: { value: TaskStatus; label: string; color: string }[] = [
  { value: "todo", label: "To Do", color: "bg-slate-200" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-200" },
  { value: "blocked", label: "Blocked", color: "bg-red-200" },
  { value: "done", label: "Done", color: "bg-green-200" },
  { value: "cancelled", label: "Cancelled", color: "bg-gray-200" },
];

export const TASK_PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "text-slate-500" },
  { value: "medium", label: "Medium", color: "text-blue-500" },
  { value: "high", label: "High", color: "text-orange-500" },
  { value: "urgent", label: "Urgent", color: "text-red-500" },
];
