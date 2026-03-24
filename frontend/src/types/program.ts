/**
 * Program types - manually maintained.
 *
 * MIGRATION NOTE:
 *   Types in this file should gradually migrate to src/types/generated.ts
 *   which is auto-generated from the FastAPI OpenAPI schema.
 *
 *   Run `npm run generate:types` to update generated types.
 *   Then re-export from generated.ts:
 *     export type Program = components["schemas"]["Program"];
 *
 *   Keep frontend-specific extensions (UI state, computed fields) here.
 */
import type { TaskStatus, TaskPriority } from "@/types/task";

export type { TaskStatus, TaskPriority };

export type ProgramStatus =
  | "intake"
  | "design"
  | "active"
  | "on_hold"
  | "completed"
  | "closed"
  | "archived";

export type MilestoneStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface Program {
  id: string;
  client_id: string;
  client_name: string;
  title: string;
  objectives: string | null;
  scope: string | null;
  budget_envelope: number | null;
  start_date: string | null;
  end_date: string | null;
  status: ProgramStatus;
  rag_status: "green" | "amber" | "red";
  milestone_count: number;
  completed_milestone_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProgramCreate {
  client_id: string;
  title: string;
  objectives?: string;
  scope?: string;
  budget_envelope?: number;
  start_date?: string;
  end_date?: string;
  milestones?: MilestoneCreate[];
}

export interface ProgramUpdate {
  title?: string;
  objectives?: string;
  scope?: string;
  budget_envelope?: number;
  start_date?: string;
  end_date?: string;
  status?: ProgramStatus;
}

export interface ProgramSummary {
  id: string;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  milestone_progress: number;
  milestones: ProgramSummaryMilestone[];
}

export interface ProgramSummaryMilestone {
  title: string;
  status: string;
  due_date: string | null;
}

export interface Milestone {
  id: string;
  program_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: MilestoneStatus;
  position: number;
  tasks: Task[];
  created_at: string;
  updated_at: string;
}

export interface MilestoneCreate {
  title: string;
  description?: string;
  due_date?: string;
  position?: number;
}

export interface MilestoneUpdate {
  title?: string;
  description?: string;
  due_date?: string;
  status?: MilestoneStatus;
  position?: number;
}

export interface Task {
  id: string;
  milestone_id: string;
  milestone_title: string;
  title: string;
  description: string | null;
  due_date: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_at: string;
  updated_at: string;
}

export interface TaskCreate {
  title: string;
  description?: string;
  due_date?: string;
  assigned_to?: string;
  priority?: TaskPriority;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  due_date?: string;
  assigned_to?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
}

export interface ProgramListResponse {
  programs: Program[];
  total: number;
}

export interface ProgramListParams {
  status?: ProgramStatus;
  client_id?: string;
  search?: string;
  skip?: number;
  limit?: number;
}

export interface ProgramDetail extends Program {
  emergency_reason: string | null;
  retrospective_due_at: string | null;
  milestones: Milestone[];
}
