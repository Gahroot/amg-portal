
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listPrograms,
  getProgram,
  createProgram,
  updateProgram,
  getProgramSummary,
  createMilestone,
  updateMilestone,
  updateTask,
} from "@/lib/api/programs";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type {
  ProgramListParams,
  ProgramCreate,
  ProgramUpdate,
  MilestoneCreate,
  MilestoneUpdate,
  TaskUpdate,
} from "@/lib/api/programs";

export function usePrograms(params?: ProgramListParams) {
  return useQuery({
    queryKey: queryKeys.programs.list(params),
    queryFn: () => listPrograms(params),
  });
}

export function useProgram(id: string) {
  return useQuery({
    queryKey: queryKeys.programs.detail(id),
    queryFn: () => getProgram(id),
    enabled: !!id,
  });
}

export function useProgramSummary(id: string) {
  return useQuery({
    queryKey: queryKeys.programs.summary(id),
    queryFn: () => getProgramSummary(id),
    enabled: !!id,
  });
}

export function useCreateProgram() {
  return useCrudMutation({
    mutationFn: (data: ProgramCreate) => createProgram(data),
    invalidateKeys: [queryKeys.programs.all],
    errorMessage: "Failed to create program",
  });
}

export function useUpdateProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProgramUpdate }) =>
      updateProgram(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.detail(variables.id) });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update program"),
  });
}

export function useCreateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      programId,
      data,
    }: {
      programId: string;
      data: MilestoneCreate;
    }) => createMilestone(programId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.programs.detail(variables.programId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create milestone"),
  });
}

export function useUpdateMilestone() {
  return useCrudMutation({
    mutationFn: ({ id, data }: { id: string; data: MilestoneUpdate }) =>
      updateMilestone(id, data),
    invalidateKeys: [queryKeys.programs.all],
    errorMessage: "Failed to update milestone",
  });
}

export function useUpdateTask() {
  return useCrudMutation({
    mutationFn: ({ id, data }: { id: string; data: TaskUpdate }) =>
      updateTask(id, data),
    invalidateKeys: [queryKeys.programs.all],
    errorMessage: "Failed to update task",
  });
}
