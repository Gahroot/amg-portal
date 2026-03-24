
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  dispatchAssignment,
  acceptAssignment,
} from "@/lib/api/assignments";
import type {
  AssignmentListParams,
  AssignmentCreateData,
  AssignmentUpdateData,
} from "@/lib/api/assignments";

export function useAssignments(params?: AssignmentListParams) {
  return useQuery({
    queryKey: ["assignments", params],
    queryFn: () => listAssignments(params),
  });
}

export function useAssignment(id: string) {
  return useQuery({
    queryKey: ["assignments", id],
    queryFn: () => getAssignment(id),
    enabled: !!id,
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AssignmentCreateData) => createAssignment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create assignment"),
  });
}

export function useUpdateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: AssignmentUpdateData;
    }) => updateAssignment(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({
        queryKey: ["assignments", variables.id],
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update assignment"),
  });
}

export function useDispatchAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dispatchAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to dispatch assignment"),
  });
}

export function useAcceptAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => acceptAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to accept assignment"),
  });
}
