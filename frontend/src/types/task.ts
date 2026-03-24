export type TaskStatus = "todo" | "in_progress" | "blocked" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface AssigneeInfo {
  id: string;
  name: string;
  email: string;
}

export interface ProgramInfo {
  id: string;
  title: string;
  status: string;
}

export interface MilestoneInfo {
  id: string;
  title: string;
  program_id: string;
}

export interface TaskBoard {
  id: string;
  milestone_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_to: string | null;
  assignee: AssigneeInfo | null;
  program: ProgramInfo | null;
  milestone: MilestoneInfo | null;
  position: number;
  depends_on: string[];
  blocked_by: string[];
  created_at: string;
  updated_at: string;
}

export interface TaskBoardListResponse {
  tasks: TaskBoard[];
  total: number;
}

export interface TaskCreate {
  title: string;
  description?: string;
  milestone_id: string;
  due_date?: string;
  assigned_to?: string;
  priority?: TaskPriority;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  assigned_to?: string | null;
}

export interface TaskReorder {
  task_id: string;
  new_status: string;
  after_task_id?: string | null;
}

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

export interface TaskBulkUpdateResult {
  updated: number;
  deleted: number;
  failed: BulkUpdateFailure[];
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
