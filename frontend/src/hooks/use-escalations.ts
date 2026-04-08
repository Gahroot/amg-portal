
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listEscalations,
  getEscalation,
  createEscalation,
  updateEscalation,
  acknowledgeEscalation,
  resolveEscalation,
  getEntityEscalations,
  triggerRiskCheck,
  exportEscalationsCsv,
  getSimpleEscalationMetrics,
  getOverdueEscalations,
  reassignEscalation,
} from "@/lib/api/escalations";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type { EscalationCreate, EscalationUpdate, EscalationListParams } from "@/types/escalation";

export function useEscalations(params?: EscalationListParams) {
  return useQuery({
    queryKey: queryKeys.escalations.list(params),
    queryFn: () => listEscalations(params),
  });
}

export function useEscalation(id: string) {
  return useQuery({
    queryKey: queryKeys.escalations.detail(id),
    queryFn: () => getEscalation(id),
    enabled: !!id,
  });
}

export function useEntityEscalations(entityType: string, entityId: string) {
  return useQuery({
    queryKey: queryKeys.escalations.entity(entityType, entityId),
    queryFn: () => getEntityEscalations(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });
}

export function useCreateEscalation() {
  return useCrudMutation({
    mutationFn: (data: EscalationCreate) => createEscalation(data),
    invalidateKeys: [queryKeys.escalations.all],
    errorMessage: "Failed to create escalation",
  });
}

export function useUpdateEscalation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: EscalationUpdate }) =>
      updateEscalation(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.escalations.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.escalations.detail(variables.id) });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update escalation"),
  });
}

export function useAcknowledgeEscalation() {
  return useCrudMutation({
    mutationFn: (id: string) => acknowledgeEscalation(id),
    invalidateKeys: [queryKeys.escalations.all],
    errorMessage: "Failed to acknowledge escalation",
  });
}

export function useResolveEscalation() {
  return useCrudMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      resolveEscalation(id, notes),
    invalidateKeys: [queryKeys.escalations.all],
    errorMessage: "Failed to resolve escalation",
  });
}

export function useTriggerRiskCheck() {
  return useCrudMutation({
    mutationFn: ({
      entityType,
      entityId,
      level,
      reason,
    }: {
      entityType: string;
      entityId: string;
      level: string;
      reason: string;
    }) => triggerRiskCheck(entityType, entityId, level, reason),
    invalidateKeys: [queryKeys.escalations.all],
    errorMessage: "Failed to trigger risk check",
  });
}

export function useExportEscalations() {
  return useMutation({
    mutationFn: (params?: EscalationListParams) => exportEscalationsCsv(params),
    onError: (error: Error) => toast.error(error.message || "Failed to export escalations"),
  });
}

export function useSimpleEscalationMetrics() {
  return useQuery({
    queryKey: queryKeys.escalations.simpleMetrics(),
    queryFn: () => getSimpleEscalationMetrics(),
    staleTime: 60_000, // 1 minute
  });
}

export function useOverdueEscalations(params?: { skip?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.escalations.overdue(params),
    queryFn: () => getOverdueEscalations(params),
  });
}

export function useReassignEscalation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newOwnerId }: { id: string; newOwnerId: string }) =>
      reassignEscalation(id, newOwnerId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.escalations.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.escalations.detail(variables.id) });
      toast.success("Escalation reassigned");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to reassign escalation"),
  });
}
