import api from "@/lib/api";
import type {
  TaskBoard,
  TaskBoardListResponse,
  TaskBulkUpdatePayload,
  TaskBulkUpdateResult,
  TaskCreate,
  TaskReorder,
  TaskUpdate,
  AssigneeInfo,
  MilestoneInfo,
  ProgramInfo,
} from "@/types/task";

interface TaskFilters {
  program_id?: string;
  assignee_id?: string;
  status?: string;
  priority?: string;
  overdue_only?: boolean;
  skip?: number;
  limit?: number;
}

export async function getTasks(filters?: TaskFilters): Promise<TaskBoardListResponse> {
  const params = new URLSearchParams();
  if (filters?.program_id) params.append("program_id", filters.program_id);
  if (filters?.assignee_id) params.append("assignee_id", filters.assignee_id);
  if (filters?.status) params.append("status", filters.status);
  if (filters?.priority) params.append("priority", filters.priority);
  if (filters?.overdue_only) params.append("overdue_only", "true");
  if (filters?.skip !== undefined) params.append("skip", String(filters.skip));
  if (filters?.limit !== undefined) params.append("limit", String(filters.limit));

  const response = await api.get<TaskBoardListResponse>(`/api/v1/tasks?${params.toString()}`);
  return response.data;
}

export async function createTask(data: TaskCreate): Promise<TaskBoard> {
  const response = await api.post<TaskBoard>("/api/v1/tasks", data);
  return response.data;
}

export async function updateTask(taskId: string, data: TaskUpdate): Promise<TaskBoard> {
  const response = await api.patch<TaskBoard>(`/api/v1/tasks/${taskId}`, data);
  return response.data;
}

export async function deleteTask(taskId: string): Promise<void> {
  await api.delete(`/api/v1/tasks/${taskId}`);
}

export async function reorderTask(data: TaskReorder): Promise<void> {
  await api.post("/api/v1/tasks/reorder", data);
}

export async function batchReorderTasks(updates: TaskReorder[]): Promise<void> {
  await api.post("/api/v1/tasks/batch-reorder", updates);
}

export async function bulkUpdateTasks(
  payload: TaskBulkUpdatePayload,
): Promise<TaskBulkUpdateResult> {
  const response = await api.post<TaskBulkUpdateResult>("/api/v1/tasks/bulk-update", payload);
  return response.data;
}

export async function getProgramsForFilter(): Promise<ProgramInfo[]> {
  const response = await api.get<ProgramInfo[]>("/api/v1/tasks/programs");
  return response.data;
}

export async function getAssigneesForFilter(): Promise<AssigneeInfo[]> {
  const response = await api.get<AssigneeInfo[]>("/api/v1/tasks/assignees");
  return response.data;
}

export async function updateTaskDependencies(
  taskId: string,
  dependsOn: string[],
): Promise<TaskBoard> {
  const response = await api.put<TaskBoard>(`/api/v1/tasks/${taskId}/dependencies`, {
    depends_on: dependsOn,
  });
  return response.data;
}

export async function getMilestonesForProgram(programId: string): Promise<MilestoneInfo[]> {
  // Fetch a small set of tasks for the program and extract unique milestones from them.
  // This reuses the existing tasks endpoint (which already joins milestones) without
  // requiring a dedicated milestones listing endpoint.
  const response = await api.get<TaskBoardListResponse>(
    `/api/v1/tasks?program_id=${programId}&limit=200`,
  );
  const milestoneMap = new Map<string, MilestoneInfo>();
  for (const task of response.data.tasks) {
    if (task.milestone && !milestoneMap.has(task.milestone.id)) {
      milestoneMap.set(task.milestone.id, task.milestone);
    }
  }
  return Array.from(milestoneMap.values());
}
