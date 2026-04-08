
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listDeliverables,
  getDeliverable,
  createDeliverable,
  updateDeliverable,
  reviewDeliverable,
  submitDeliverable,
} from "@/lib/api/deliverables";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type {
  DeliverableListParams,
  DeliverableCreateData,
  DeliverableUpdateData,
  DeliverableReviewData,
} from "@/lib/api/deliverables";

export function useDeliverables(params?: DeliverableListParams) {
  return useQuery({
    queryKey: queryKeys.deliverables.list(params),
    queryFn: () => listDeliverables(params),
  });
}

export function useDeliverable(id: string) {
  return useQuery({
    queryKey: queryKeys.deliverables.detail(id),
    queryFn: () => getDeliverable(id),
    enabled: !!id,
  });
}

export function useCreateDeliverable() {
  return useCrudMutation({
    mutationFn: (data: DeliverableCreateData) => createDeliverable(data),
    invalidateKeys: [queryKeys.deliverables.all],
    errorMessage: "Failed to create deliverable",
  });
}

export function useUpdateDeliverable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: DeliverableUpdateData;
    }) => updateDeliverable(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deliverables.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.deliverables.detail(variables.id),
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update deliverable"),
  });
}

export function useSubmitDeliverable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      submitDeliverable(id, file),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deliverables.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.deliverables.detail(variables.id),
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to submit deliverable"),
  });
}

export function useReviewDeliverable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: DeliverableReviewData;
    }) => reviewDeliverable(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deliverables.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.deliverables.detail(variables.id),
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to review deliverable"),
  });
}
