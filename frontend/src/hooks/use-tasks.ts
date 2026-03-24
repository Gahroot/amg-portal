
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getTasks,
  createTask,
  updateTask,
  reorderTask,
  getProgramsForFilter,
  getAssigneesForFilter,
  getMilestonesForProgram,
} from "@/lib/api/tasks";
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
    queryKey: ["tasks", params],
    queryFn: () => getTasks(params),
  });
}

export function useTaskPrograms() {
  return useQuery({
    queryKey: ["tasks", "programs"],
    queryFn: () => getProgramsForFilter(),
  });
}

export function useTaskAssignees() {
  return useQuery({
    queryKey: ["tasks", "assignees"],
    queryFn: () => getAssigneesForFilter(),
  });
}

export function useTaskMilestones(programId: string | null) {
  return useQuery({
    queryKey: ["tasks", "milestones", programId],
    queryFn: () => getMilestonesForProgram(programId!),
    enabled: !!programId,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TaskCreate) => createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create task"),
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TaskUpdate }) =>
      updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update task"),
  });
}

export function useReorderTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TaskReorder) => reorderTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to reorder task"),
  });
}
