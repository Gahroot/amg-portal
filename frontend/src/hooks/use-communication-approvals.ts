
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  submitForReview,
  reviewCommunication,
  getPendingReviews,
  getCommunicationsByStatus,
} from "@/lib/api/communications";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type { ReviewAction } from "@/types/communication";

export function usePendingReviews(params?: {
  skip?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: queryKeys.communications.pendingReviews(params),
    queryFn: () => getPendingReviews(params),
  });
}

export function useCommunicationsByStatus(
  status: string,
  params?: { skip?: number; limit?: number }
) {
  return useQuery({
    queryKey: queryKeys.communications.byStatus(status, params),
    queryFn: () => getCommunicationsByStatus(status, params),
    enabled: !!status,
  });
}

export function useSubmitForReview() {
  return useCrudMutation({
    mutationFn: (id: string) => submitForReview(id),
    invalidateKeys: [queryKeys.communications.all],
    successMessage: "Communication submitted for review",
    errorMessage: "Failed to submit for review",
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
      queryClient.invalidateQueries({ queryKey: queryKeys.communications.all });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to review communication");
    },
  });
}
