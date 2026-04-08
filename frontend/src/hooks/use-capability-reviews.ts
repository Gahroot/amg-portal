
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listCapabilityReviews,
  getCapabilityReview,
  createCapabilityReview,
  updateCapabilityReview,
  completeCapabilityReview,
  getCapabilityReviewStatistics,
  getPendingReviews,
  getOverdueReviews,
  generateAnnualReviews,
} from "@/lib/api/capability-reviews";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type {
  CapabilityReviewListParams,
  CreateCapabilityReviewRequest,
  UpdateCapabilityReviewRequest,
  CompleteCapabilityReviewRequest,
  GenerateAnnualReviewsRequest,
} from "@/types/capability-review";

export function useCapabilityReviews(params?: CapabilityReviewListParams) {
  return useQuery({
    queryKey: queryKeys.capabilityReviews.list(params),
    queryFn: () => listCapabilityReviews(params),
  });
}

export function useCapabilityReview(id: string) {
  return useQuery({
    queryKey: queryKeys.capabilityReviews.detail(id),
    queryFn: () => getCapabilityReview(id),
    enabled: !!id,
  });
}

export function useCapabilityReviewStatistics() {
  return useQuery({
    queryKey: queryKeys.capabilityReviews.statistics(),
    queryFn: () => getCapabilityReviewStatistics(),
  });
}

export function usePendingCapabilityReviews(params?: {
  skip?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: queryKeys.capabilityReviews.pending(params),
    queryFn: () => getPendingReviews(params),
  });
}

export function useOverdueCapabilityReviews() {
  return useQuery({
    queryKey: queryKeys.capabilityReviews.overdue(),
    queryFn: () => getOverdueReviews(),
  });
}

export function useCreateCapabilityReview() {
  return useCrudMutation({
    mutationFn: (data: CreateCapabilityReviewRequest) =>
      createCapabilityReview(data),
    invalidateKeys: [queryKeys.capabilityReviews.all],
    errorMessage: "Failed to create capability review",
  });
}

export function useUpdateCapabilityReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateCapabilityReviewRequest;
    }) => updateCapabilityReview(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.capabilityReviews.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.capabilityReviews.detail(variables.id),
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update capability review"),
  });
}

export function useCompleteCapabilityReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: CompleteCapabilityReviewRequest;
    }) => completeCapabilityReview(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.capabilityReviews.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.capabilityReviews.detail(variables.id),
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to complete capability review"),
  });
}

export function useGenerateAnnualReviews() {
  return useCrudMutation({
    mutationFn: (data: GenerateAnnualReviewsRequest) =>
      generateAnnualReviews(data),
    invalidateKeys: [queryKeys.capabilityReviews.all],
    errorMessage: "Failed to generate annual reviews",
  });
}
