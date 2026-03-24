
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
    queryKey: ["programs", params],
    queryFn: () => listPrograms(params),
  });
}

export function useProgram(id: string) {
  return useQuery({
    queryKey: ["programs", id],
    queryFn: () => getProgram(id),
    enabled: !!id,
  });
}

export function useProgramSummary(id: string) {
  return useQuery({
    queryKey: ["programs", id, "summary"],
    queryFn: () => getProgramSummary(id),
    enabled: !!id,
  });
}

export function useCreateProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProgramCreate) => createProgram(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create program"),
  });
}

export function useUpdateProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProgramUpdate }) =>
      updateProgram(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      queryClient.invalidateQueries({ queryKey: ["programs", variables.id] });
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
        queryKey: ["programs", variables.programId],
      });
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create milestone"),
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MilestoneUpdate }) =>
      updateMilestone(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update milestone"),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TaskUpdate }) =>
      updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update task"),
  });
}
