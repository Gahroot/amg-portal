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
import { createApiClient } from "./factory";

interface TaskFilters {
  program_id?: string;
  assignee_id?: string;
  status?: string;
  priority?: string;
  overdue_only?: boolean;
  skip?: number;
  limit?: number;
}

const tasksApi = createApiClient<TaskBoard, TaskBoardListResponse, TaskCreate, TaskUpdate>(
  "/api/v1/tasks"
);

// getTasks uses custom param building, so keep it manual
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

export const getTask = tasksApi.get;
export const createTask = tasksApi.create;

// updateTask uses taskId param name but same signature
export async function updateTask(taskId: string, data: TaskUpdate): Promise<TaskBoard> {
  return tasksApi.update(taskId, data);
}

export async function deleteTask(taskId: string): Promise<void> {
  return tasksApi.delete(taskId);
}

// Custom endpoints

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
