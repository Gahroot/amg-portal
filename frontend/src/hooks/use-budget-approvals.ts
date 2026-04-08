
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listBudgetApprovalRequests,
  getPendingBudgetApprovals,
  getBudgetApprovalRequest,
  cancelBudgetApprovalRequest,
  decideBudgetApprovalStep,
  getBudgetApprovalHistory,
  listApprovalThresholds,
  createApprovalThreshold,
  updateApprovalThreshold,
  deleteApprovalThreshold,
  listApprovalChains,
  getApprovalChain,
  createApprovalChain,
  updateApprovalChain,
  deleteApprovalChain,
  addChainStep,
  removeChainStep,
} from "@/lib/api/budget-approvals";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type {
  BudgetApprovalListParams,
  BudgetApprovalStepDecision,
  ApprovalThresholdCreate,
  ApprovalThresholdUpdate,
  ApprovalChainCreate,
  ApprovalChainUpdate,
  ApprovalChainStepCreate,
} from "@/lib/api/budget-approvals";

export function useBudgetApprovalRequests(params?: BudgetApprovalListParams) {
  return useQuery({
    queryKey: queryKeys.budgetApprovals.requests.list(params),
    queryFn: () => listBudgetApprovalRequests(params),
  });
}

export function usePendingBudgetApprovals() {
  return useQuery({
    queryKey: queryKeys.budgetApprovals.pending(),
    queryFn: getPendingBudgetApprovals,
  });
}

export function useBudgetApprovalRequest(id: string) {
  return useQuery({
    queryKey: queryKeys.budgetApprovals.requests.detail(id),
    queryFn: () => getBudgetApprovalRequest(id),
    enabled: !!id,
  });
}

export function useBudgetApprovalHistory(requestId: string) {
  return useQuery({
    queryKey: queryKeys.budgetApprovals.history(requestId),
    queryFn: () => getBudgetApprovalHistory(requestId),
    enabled: !!requestId,
  });
}

export function useDecideBudgetApprovalStep() {
  return useCrudMutation({
    mutationFn: ({
      stepId,
      data,
    }: {
      stepId: string;
      data: BudgetApprovalStepDecision;
    }) => decideBudgetApprovalStep(stepId, data),
    invalidateKeys: [queryKeys.budgetApprovals.all],
    successMessage: "Decision submitted successfully",
    errorMessage: "Failed to submit decision",
  });
}

export function useCancelBudgetApprovalRequest() {
  return useCrudMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      cancelBudgetApprovalRequest(id, reason),
    invalidateKeys: [queryKeys.budgetApprovals.all],
    successMessage: "Request cancelled",
    errorMessage: "Failed to cancel request",
  });
}

// === Approval Threshold Hooks ===

export function useApprovalThresholds(isActive?: boolean) {
  return useQuery({
    queryKey: queryKeys.budgetApprovals.thresholds.list(isActive),
    queryFn: () => listApprovalThresholds(isActive),
  });
}

export function useCreateApprovalThreshold() {
  return useCrudMutation({
    mutationFn: (data: ApprovalThresholdCreate) =>
      createApprovalThreshold(data),
    invalidateKeys: [queryKeys.budgetApprovals.thresholds.all],
    successMessage: "Threshold created",
    errorMessage: "Failed to create threshold",
  });
}

export function useUpdateApprovalThreshold() {
  return useCrudMutation({
    mutationFn: ({ id, data }: { id: string; data: ApprovalThresholdUpdate }) =>
      updateApprovalThreshold(id, data),
    invalidateKeys: [queryKeys.budgetApprovals.thresholds.all],
    successMessage: "Threshold updated",
    errorMessage: "Failed to update threshold",
  });
}

export function useDeleteApprovalThreshold() {
  return useCrudMutation({
    mutationFn: (id: string) => deleteApprovalThreshold(id),
    invalidateKeys: [queryKeys.budgetApprovals.thresholds.all],
    successMessage: "Threshold deleted",
    errorMessage: "Failed to delete threshold",
  });
}

// === Approval Chain Hooks ===

export function useApprovalChains(isActive?: boolean) {
  return useQuery({
    queryKey: queryKeys.budgetApprovals.chains.list(isActive),
    queryFn: () => listApprovalChains(isActive),
  });
}

export function useApprovalChain(id: string) {
  return useQuery({
    queryKey: queryKeys.budgetApprovals.chains.detail(id),
    queryFn: () => getApprovalChain(id),
    enabled: !!id,
  });
}

export function useCreateApprovalChain() {
  return useCrudMutation({
    mutationFn: (data: ApprovalChainCreate) => createApprovalChain(data),
    invalidateKeys: [queryKeys.budgetApprovals.chains.all],
    successMessage: "Approval chain created",
    errorMessage: "Failed to create approval chain",
  });
}

export function useUpdateApprovalChain() {
  return useCrudMutation({
    mutationFn: ({ id, data }: { id: string; data: ApprovalChainUpdate }) =>
      updateApprovalChain(id, data),
    invalidateKeys: [queryKeys.budgetApprovals.chains.all],
    successMessage: "Approval chain updated",
    errorMessage: "Failed to update approval chain",
  });
}

export function useDeleteApprovalChain() {
  return useCrudMutation({
    mutationFn: (id: string) => deleteApprovalChain(id),
    invalidateKeys: [queryKeys.budgetApprovals.chains.all],
    successMessage: "Approval chain deleted",
    errorMessage: "Failed to delete approval chain",
  });
}

export function useAddChainStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      chainId,
      data,
    }: {
      chainId: string;
      data: ApprovalChainStepCreate;
    }) => addChainStep(chainId, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.budgetApprovals.chains.detail(variables.chainId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.budgetApprovals.chains.all,
      });
      toast.success("Step added");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to add step"),
  });
}

export function useRemoveChainStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chainId, stepId }: { chainId: string; stepId: string }) =>
      removeChainStep(chainId, stepId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.budgetApprovals.chains.detail(variables.chainId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.budgetApprovals.chains.all,
      });
      toast.success("Step removed");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to remove step"),
  });
}
