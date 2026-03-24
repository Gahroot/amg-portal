
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listDeletionRequests,
  getDeletionRequest,
  createDeletionRequest,
  approveDeletionRequest,
  rejectDeletionRequest,
} from "@/lib/api/deletion-requests";
import type {
  DeletionRequestCreate,
  DeletionRequestListParams,
  RejectDeletionRequest,
} from "@/types/deletion-request";

export function useDeletionRequests(params?: DeletionRequestListParams) {
  return useQuery({
    queryKey: ["deletion-requests", params],
    queryFn: () => listDeletionRequests(params),
  });
}

export function useDeletionRequest(id: string) {
  return useQuery({
    queryKey: ["deletion-requests", id],
    queryFn: () => getDeletionRequest(id),
    enabled: !!id,
  });
}

export function useCreateDeletionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DeletionRequestCreate) => createDeletionRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deletion-requests"] });
      toast.success("Deletion request submitted for authorization");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to submit deletion request"),
  });
}

export function useApproveDeletionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approveDeletionRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deletion-requests"] });
      toast.success("Deletion authorized and executed");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to authorize deletion request"),
  });
}

export function useRejectDeletionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectDeletionRequest }) =>
      rejectDeletionRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deletion-requests"] });
      toast.success("Deletion request rejected");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to reject deletion request"),
  });
}
