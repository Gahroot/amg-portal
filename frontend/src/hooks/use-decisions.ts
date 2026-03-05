"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listDecisions,
  listPendingDecisions,
  getDecision,
  createDecision,
  respondToDecision,
} from "@/lib/api/decisions";
import type {
  DecisionRequest,
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
    queryKey: ["decisions", params],
    queryFn: () => listDecisions(params),
  });
}

export function useDecision(id: string) {
  return useQuery({
    queryKey: ["decision", id],
    queryFn: () => getDecision(id),
    enabled: !!id,
  });
}

export function usePendingDecisions(params?: { skip?: number; limit?: number }) {
  return useQuery({
    queryKey: ["decisions", "pending", params],
    queryFn: () => listPendingDecisions(params),
    refetchInterval: 30000, // Poll every 30 seconds for pending decisions
  });
}

export function useCreateDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DecisionCreateData) => createDecision(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decisions"] });
    },
  });
}

export function useRespondToDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DecisionResponseData }) =>
      respondToDecision(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["decision", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["decisions"] });
      queryClient.invalidateQueries({ queryKey: ["decisions", "pending"] });
    },
  });
}
