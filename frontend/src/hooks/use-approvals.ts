
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listApprovals,
  requestApproval,
  decideApproval,
  getProgramApprovals,
} from "@/lib/api/approvals";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type {
  ApprovalListParams,
  ApprovalRequest,
  ApprovalDecision,
} from "@/lib/api/approvals";

export function useApprovals(params?: ApprovalListParams) {
  return useQuery({
    queryKey: queryKeys.approvals.list(params),
    queryFn: () => listApprovals(params),
  });
}

export function useProgramApprovals(programId: string) {
  return useQuery({
    queryKey: queryKeys.approvals.program(programId),
    queryFn: () => getProgramApprovals(programId),
    enabled: !!programId,
  });
}

export function useSubmitApproval() {
  return useCrudMutation({
    mutationFn: (data: ApprovalRequest) => requestApproval(data),
    invalidateKeys: [queryKeys.approvals.all],
    errorMessage: "Failed to submit approval request",
  });
}

export function useDecideApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApprovalDecision }) =>
      decideApproval(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.detail(variables.id) });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to decide approval"),
  });
}
