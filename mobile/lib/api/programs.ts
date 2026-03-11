import api from '@/lib/api';
import type {
  Program,
  ProgramDetail,
  ProgramListResponse,
  ProgramCreateData,
  ProgramUpdateData,
  Milestone,
  Task,
  TaskStatus,
} from '@/types/program';

export async function listPrograms(params?: {
  client_id?: string;
  status?: string;
  search?: string;
  skip?: number;
  limit?: number;
}): Promise<ProgramListResponse> {
  const res = await api.get<ProgramListResponse>('/programs', { params });
  return res.data;
}

export async function getProgram(id: string): Promise<ProgramDetail> {
  const res = await api.get<ProgramDetail>(`/programs/${id}`);
  return res.data;
}

export async function createProgram(data: ProgramCreateData): Promise<Program> {
  const res = await api.post<Program>('/programs', data);
  return res.data;
}

export async function updateProgram(id: string, data: ProgramUpdateData): Promise<Program> {
  const res = await api.put<Program>(`/programs/${id}`, data);
  return res.data;
}

export async function submitProgramForApproval(id: string): Promise<Program> {
  const res = await api.post<Program>(`/programs/${id}/submit-approval`);
  return res.data;
}

export async function initiateProgramClosure(id: string): Promise<Program> {
  const res = await api.post<Program>(`/programs/${id}/initiate-closure`);
  return res.data;
}

// Milestones
export interface MilestoneCreateData {
  title: string;
  description?: string;
  due_date?: string;
}

export interface MilestoneUpdateData {
  title?: string;
  description?: string;
  due_date?: string;
  status?: string;
}

export async function listMilestones(programId: string): Promise<Milestone[]> {
  const res = await api.get<Milestone[]>(`/programs/${programId}/milestones`);
  return res.data;
}

export async function createMilestone(programId: string, data: MilestoneCreateData): Promise<Milestone> {
  const res = await api.post<Milestone>(`/programs/${programId}/milestones`, data);
  return res.data;
}

export async function updateMilestone(
  programId: string,
  milestoneId: string,
  data: MilestoneUpdateData,
): Promise<Milestone> {
  const res = await api.put<Milestone>(`/programs/${programId}/milestones/${milestoneId}`, data);
  return res.data;
}

// Tasks
export interface TaskCreateData {
  milestone_id: string;
  title: string;
  description?: string;
  priority?: string;
  due_date?: string;
  assigned_to?: string;
}

export interface TaskUpdateData {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: string;
  due_date?: string;
  assigned_to?: string;
}

export async function listTasks(programId: string): Promise<Task[]> {
  const res = await api.get<Task[]>(`/programs/${programId}/tasks`);
  return res.data;
}

export async function createTask(programId: string, data: TaskCreateData): Promise<Task> {
  const res = await api.post<Task>(`/programs/${programId}/tasks`, data);
  return res.data;
}

export async function updateTask(programId: string, taskId: string, data: TaskUpdateData): Promise<Task> {
  const res = await api.patch<Task>(`/programs/${programId}/tasks/${taskId}`, data);
  return res.data;
}
