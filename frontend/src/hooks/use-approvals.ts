
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listApprovals,
  requestApproval,
  decideApproval,
  getProgramApprovals,
} from "@/lib/api/approvals";
import type {
  ApprovalListParams,
  ApprovalRequest,
  ApprovalDecision,
} from "@/lib/api/approvals";

export function useApprovals(params?: ApprovalListParams) {
  return useQuery({
    queryKey: ["approvals", params],
    queryFn: () => listApprovals(params),
  });
}

export function useProgramApprovals(programId: string) {
  return useQuery({
    queryKey: ["approvals", "program", programId],
    queryFn: () => getProgramApprovals(programId),
    enabled: !!programId,
  });
}

export function useSubmitApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ApprovalRequest) => requestApproval(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to submit approval request"),
  });
}

export function useDecideApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApprovalDecision }) =>
      decideApproval(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["approvals", variables.id] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to decide approval"),
  });
}
