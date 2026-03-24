
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
    queryKey: ["budget-approvals", "requests", params],
    queryFn: () => listBudgetApprovalRequests(params),
  });
}

export function usePendingBudgetApprovals() {
  return useQuery({
    queryKey: ["budget-approvals", "pending"],
    queryFn: getPendingBudgetApprovals,
  });
}

export function useBudgetApprovalRequest(id: string) {
  return useQuery({
    queryKey: ["budget-approvals", "requests", id],
    queryFn: () => getBudgetApprovalRequest(id),
    enabled: !!id,
  });
}

export function useBudgetApprovalHistory(requestId: string) {
  return useQuery({
    queryKey: ["budget-approvals", "history", requestId],
    queryFn: () => getBudgetApprovalHistory(requestId),
    enabled: !!requestId,
  });
}

export function useDecideBudgetApprovalStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      stepId,
      data,
    }: {
      stepId: string;
      data: BudgetApprovalStepDecision;
    }) => decideBudgetApprovalStep(stepId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-approvals"] });
      toast.success("Decision submitted successfully");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to submit decision"),
  });
}

export function useCancelBudgetApprovalRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      cancelBudgetApprovalRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-approvals"] });
      toast.success("Request cancelled");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to cancel request"),
  });
}

// === Approval Threshold Hooks ===

export function useApprovalThresholds(isActive?: boolean) {
  return useQuery({
    queryKey: ["budget-approvals", "thresholds", { isActive }],
    queryFn: () => listApprovalThresholds(isActive),
  });
}

export function useCreateApprovalThreshold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ApprovalThresholdCreate) =>
      createApprovalThreshold(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["budget-approvals", "thresholds"],
      });
      toast.success("Threshold created");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create threshold"),
  });
}

export function useUpdateApprovalThreshold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApprovalThresholdUpdate }) =>
      updateApprovalThreshold(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["budget-approvals", "thresholds"],
      });
      toast.success("Threshold updated");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update threshold"),
  });
}

export function useDeleteApprovalThreshold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteApprovalThreshold(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["budget-approvals", "thresholds"],
      });
      toast.success("Threshold deleted");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to delete threshold"),
  });
}

// === Approval Chain Hooks ===

export function useApprovalChains(isActive?: boolean) {
  return useQuery({
    queryKey: ["budget-approvals", "chains", { isActive }],
    queryFn: () => listApprovalChains(isActive),
  });
}

export function useApprovalChain(id: string) {
  return useQuery({
    queryKey: ["budget-approvals", "chains", id],
    queryFn: () => getApprovalChain(id),
    enabled: !!id,
  });
}

export function useCreateApprovalChain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ApprovalChainCreate) => createApprovalChain(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["budget-approvals", "chains"],
      });
      toast.success("Approval chain created");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create approval chain"),
  });
}

export function useUpdateApprovalChain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApprovalChainUpdate }) =>
      updateApprovalChain(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["budget-approvals", "chains"],
      });
      toast.success("Approval chain updated");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update approval chain"),
  });
}

export function useDeleteApprovalChain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteApprovalChain(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["budget-approvals", "chains"],
      });
      toast.success("Approval chain deleted");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to delete approval chain"),
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
        queryKey: ["budget-approvals", "chains", variables.chainId],
      });
      queryClient.invalidateQueries({
        queryKey: ["budget-approvals", "chains", { isActive: undefined }],
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
        queryKey: ["budget-approvals", "chains", variables.chainId],
      });
      queryClient.invalidateQueries({
        queryKey: ["budget-approvals", "chains"],
      });
      toast.success("Step removed");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to remove step"),
  });
}
