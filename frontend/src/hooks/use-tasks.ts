
import { useQuery } from "@tanstack/react-query";
import {
  getTasks,
  createTask,
  updateTask,
  reorderTask,
  getProgramsForFilter,
  getAssigneesForFilter,
  getMilestonesForProgram,
} from "@/lib/api/tasks";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type { TaskCreate, TaskUpdate, TaskReorder } from "@/types/task";

interface TaskFilters {
  program_id?: string;
  assignee_id?: string;
  status?: string;
  priority?: string;
  overdue_only?: boolean;
  skip?: number;
  limit?: number;
}

export function useTasks(params?: TaskFilters) {
  return useQuery({
    queryKey: queryKeys.tasks.list(params),
    queryFn: () => getTasks(params),
  });
}

export function useTaskPrograms() {
  return useQuery({
    queryKey: queryKeys.tasks.programs(),
    queryFn: () => getProgramsForFilter(),
  });
}

export function useTaskAssignees() {
  return useQuery({
    queryKey: queryKeys.tasks.assignees(),
    queryFn: () => getAssigneesForFilter(),
  });
}

export function useTaskMilestones(programId: string | null) {
  return useQuery({
    queryKey: queryKeys.tasks.milestones(programId),
    queryFn: () => getMilestonesForProgram(programId!),
    enabled: !!programId,
  });
}

export function useCreateTask() {
  return useCrudMutation({
    mutationFn: (data: TaskCreate) => createTask(data),
    invalidateKeys: [queryKeys.tasks.all],
    errorMessage: "Failed to create task",
  });
}

export function useUpdateTaskStatus() {
  return useCrudMutation({
    mutationFn: ({ id, data }: { id: string; data: TaskUpdate }) =>
      updateTask(id, data),
    invalidateKeys: [queryKeys.tasks.all],
    errorMessage: "Failed to update task",
  });
}

export function useReorderTask() {
  return useCrudMutation({
    mutationFn: (data: TaskReorder) => reorderTask(data),
    invalidateKeys: [queryKeys.tasks.all],
    errorMessage: "Failed to reorder task",
  });
}
