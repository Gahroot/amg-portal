
import { useQuery } from "@tanstack/react-query";
import {
  listDeletionRequests,
  getDeletionRequest,
  createDeletionRequest,
  approveDeletionRequest,
  rejectDeletionRequest,
} from "@/lib/api/deletion-requests";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type {
  DeletionRequestCreate,
  DeletionRequestListParams,
  RejectDeletionRequest,
} from "@/types/deletion-request";

export function useDeletionRequests(params?: DeletionRequestListParams) {
  return useQuery({
    queryKey: queryKeys.deletionRequests.list(params),
    queryFn: () => listDeletionRequests(params),
  });
}

export function useDeletionRequest(id: string) {
  return useQuery({
    queryKey: queryKeys.deletionRequests.detail(id),
    queryFn: () => getDeletionRequest(id),
    enabled: !!id,
  });
}

export function useCreateDeletionRequest() {
  return useCrudMutation({
    mutationFn: (data: DeletionRequestCreate) => createDeletionRequest(data),
    invalidateKeys: [queryKeys.deletionRequests.all],
    successMessage: "Deletion request submitted for authorization",
    errorMessage: "Failed to submit deletion request",
  });
}

export function useApproveDeletionRequest() {
  return useCrudMutation({
    mutationFn: (id: string) => approveDeletionRequest(id),
    invalidateKeys: [queryKeys.deletionRequests.all],
    successMessage: "Deletion authorized and executed",
    errorMessage: "Failed to authorize deletion request",
  });
}

export function useRejectDeletionRequest() {
  return useCrudMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectDeletionRequest }) =>
      rejectDeletionRequest(id, data),
    invalidateKeys: [queryKeys.deletionRequests.all],
    successMessage: "Deletion request rejected",
    errorMessage: "Failed to reject deletion request",
  });
}
