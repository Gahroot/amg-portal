export type ProgramStatus = 'intake' | 'design' | 'active' | 'on_hold' | 'completed' | 'closed' | 'archived';
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type RAGStatus = 'red' | 'amber' | 'green';

export interface Task {
  id: string;
  milestone_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  program_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: MilestoneStatus;
  position: number;
  task_count: number;
  completed_task_count: number;
  tasks: Task[];
  created_at: string;
  updated_at: string;
}

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
  created_by: string;
  rag_status: RAGStatus;
  milestone_count: number;
  completed_milestone_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProgramDetail extends Program {
  milestones: Milestone[];
}

export interface ProgramListResponse {
  programs: Program[];
  total: number;
}

export interface ProgramCreateData {
  client_id: string;
  title: string;
  objectives?: string;
  scope?: string;
  budget_envelope?: number;
  start_date?: string;
  end_date?: string;
}

export interface ProgramUpdateData {
  title?: string;
  objectives?: string;
  scope?: string;
  budget_envelope?: number;
  start_date?: string;
  end_date?: string;
  status?: ProgramStatus;
}
