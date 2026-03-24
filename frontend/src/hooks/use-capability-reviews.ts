
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
import type {
  CapabilityReviewListParams,
  CreateCapabilityReviewRequest,
  UpdateCapabilityReviewRequest,
  CompleteCapabilityReviewRequest,
  GenerateAnnualReviewsRequest,
} from "@/types/capability-review";

export function useCapabilityReviews(params?: CapabilityReviewListParams) {
  return useQuery({
    queryKey: ["capability-reviews", params],
    queryFn: () => listCapabilityReviews(params),
  });
}

export function useCapabilityReview(id: string) {
  return useQuery({
    queryKey: ["capability-reviews", id],
    queryFn: () => getCapabilityReview(id),
    enabled: !!id,
  });
}

export function useCapabilityReviewStatistics() {
  return useQuery({
    queryKey: ["capability-reviews", "statistics"],
    queryFn: () => getCapabilityReviewStatistics(),
  });
}

export function usePendingCapabilityReviews(params?: {
  skip?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["capability-reviews", "pending", params],
    queryFn: () => getPendingReviews(params),
  });
}

export function useOverdueCapabilityReviews() {
  return useQuery({
    queryKey: ["capability-reviews", "overdue"],
    queryFn: () => getOverdueReviews(),
  });
}

export function useCreateCapabilityReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCapabilityReviewRequest) =>
      createCapabilityReview(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-reviews"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create capability review"),
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
      queryClient.invalidateQueries({ queryKey: ["capability-reviews"] });
      queryClient.invalidateQueries({
        queryKey: ["capability-reviews", variables.id],
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
      queryClient.invalidateQueries({ queryKey: ["capability-reviews"] });
      queryClient.invalidateQueries({
        queryKey: ["capability-reviews", variables.id],
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to complete capability review"),
  });
}

export function useGenerateAnnualReviews() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GenerateAnnualReviewsRequest) =>
      generateAnnualReviews(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capability-reviews"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to generate annual reviews"),
  });
}
