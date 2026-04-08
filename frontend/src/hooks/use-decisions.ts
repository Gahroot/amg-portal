
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listDecisions,
  listPendingDecisions,
  getDecision,
  createDecision,
  respondToDecision,
} from "@/lib/api/decisions";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type {
  DecisionCreateData,
  DecisionResponseData,
} from "@/types/communication";

// Decisions
export function useDecisions(params?: {
  client_id?: string;
  status?: string;
  skip?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: queryKeys.decisions.list(params),
    queryFn: () => listDecisions(params),
  });
}

export function useDecision(id: string) {
  return useQuery({
    queryKey: queryKeys.decisions.detail(id),
    queryFn: () => getDecision(id),
    enabled: !!id,
  });
}

export function usePendingDecisions(params?: { skip?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.decisions.pending(params),
    queryFn: () => listPendingDecisions(params),
    refetchInterval: 30000, // Poll every 30 seconds for pending decisions
  });
}

export function useCreateDecision() {
  return useCrudMutation({
    mutationFn: (data: DecisionCreateData) => createDecision(data),
    invalidateKeys: [queryKeys.decisions.all],
    errorMessage: "Failed to create decision request",
  });
}

export function useRespondToDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DecisionResponseData }) =>
      respondToDecision(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions.all });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to respond to decision"),
  });
}
