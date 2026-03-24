
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  submitForReview,
  reviewCommunication,
  getPendingReviews,
  getCommunicationsByStatus,
} from "@/lib/api/communications";
import type { ReviewAction } from "@/types/communication";

export function usePendingReviews(params?: {
  skip?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["communications", "pending-reviews", params],
    queryFn: () => getPendingReviews(params),
  });
}

export function useCommunicationsByStatus(
  status: string,
  params?: { skip?: number; limit?: number }
) {
  return useQuery({
    queryKey: ["communications", "by-status", status, params],
    queryFn: () => getCommunicationsByStatus(status, params),
    enabled: !!status,
  });
}

export function useSubmitForReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => submitForReview(id),
    onSuccess: () => {
      toast.success("Communication submitted for review");
      queryClient.invalidateQueries({ queryKey: ["communications"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit for review");
    },
  });
}

export function useReviewCommunication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReviewAction }) =>
      reviewCommunication(id, data),
    onSuccess: (_data, variables) => {
      const action = variables.data.action === "approve" ? "approved" : "rejected";
      toast.success(`Communication ${action}`);
      queryClient.invalidateQueries({ queryKey: ["communications"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to review communication");
    },
  });
}
