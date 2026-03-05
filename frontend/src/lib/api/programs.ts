import api from "@/lib/api";

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

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "blocked"
  | "done"
  | "cancelled";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

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

export async function listPrograms(
  params?: ProgramListParams
): Promise<ProgramListResponse> {
  const response = await api.get<ProgramListResponse>("/api/v1/programs/", {
    params,
  });
  return response.data;
}

export async function createProgram(data: ProgramCreate): Promise<Program> {
  const response = await api.post<Program>("/api/v1/programs/", data);
  return response.data;
}

export interface ProgramDetail extends Program {
  milestones: Milestone[];
}

export async function getProgram(id: string): Promise<ProgramDetail> {
  const response = await api.get<ProgramDetail>(`/api/v1/programs/${id}`);
  return response.data;
}

export async function updateProgram(
  id: string,
  data: ProgramUpdate
): Promise<Program> {
  const response = await api.patch<Program>(`/api/v1/programs/${id}`, data);
  return response.data;
}

export async function getProgramSummary(
  id: string
): Promise<ProgramSummary> {
  const response = await api.get<ProgramSummary>(
    `/api/v1/programs/${id}/summary`
  );
  return response.data;
}

export async function createMilestone(
  programId: string,
  data: MilestoneCreate
): Promise<Milestone> {
  const response = await api.post<Milestone>(
    `/api/v1/programs/${programId}/milestones`,
    data
  );
  return response.data;
}

export async function updateMilestone(
  id: string,
  data: MilestoneUpdate
): Promise<Milestone> {
  const response = await api.patch<Milestone>(
    `/api/v1/programs/milestones/${id}`,
    data
  );
  return response.data;
}

export async function deleteMilestone(id: string): Promise<void> {
  await api.delete(`/api/v1/programs/milestones/${id}`);
}

export async function createTask(
  milestoneId: string,
  data: TaskCreate
): Promise<Task> {
  const response = await api.post<Task>(
    `/api/v1/programs/milestones/${milestoneId}/tasks`,
    data
  );
  return response.data;
}

export async function updateTask(
  id: string,
  data: TaskUpdate
): Promise<Task> {
  const response = await api.patch<Task>(`/api/v1/programs/tasks/${id}`, data);
  return response.data;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/api/v1/programs/tasks/${id}`);
}
