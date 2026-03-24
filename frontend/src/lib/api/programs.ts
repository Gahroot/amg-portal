import api from "@/lib/api";
import type {
  ProgramStatus,
  MilestoneStatus,
  TaskStatus,
  TaskPriority,
  Program,
  ProgramCreate,
  ProgramUpdate,
  ProgramSummary,
  ProgramSummaryMilestone,
  Milestone,
  MilestoneCreate,
  MilestoneUpdate,
  Task,
  TaskCreate,
  TaskUpdate,
  ProgramListResponse,
  ProgramListParams,
  ProgramDetail,
} from "@/types/program";

// Re-export types for convenience
export type {
  ProgramStatus,
  MilestoneStatus,
  TaskStatus,
  TaskPriority,
  Program,
  ProgramCreate,
  ProgramUpdate,
  ProgramSummary,
  ProgramSummaryMilestone,
  Milestone,
  MilestoneCreate,
  MilestoneUpdate,
  Task,
  TaskCreate,
  TaskUpdate,
  ProgramListResponse,
  ProgramListParams,
  ProgramDetail,
};

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

export async function emergencyActivateProgram(
  id: string,
  data: { emergency_reason: string }
): Promise<ProgramDetail> {
  const response = await api.post<ProgramDetail>(
    `/api/v1/programs/${id}/emergency-activate`,
    data
  );
  return response.data;
}
