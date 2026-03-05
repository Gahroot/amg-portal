"use client";

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
} from "@/lib/api/escalations";
import type { EscalationCreate, EscalationUpdate, EscalationListParams } from "@/types/escalation";

export function useEscalations(params?: EscalationListParams) {
  return useQuery({
    queryKey: ["escalations", params],
    queryFn: () => listEscalations(params),
  });
}

export function useEscalation(id: string) {
  return useQuery({
    queryKey: ["escalations", id],
    queryFn: () => getEscalation(id),
    enabled: !!id,
  });
}

export function useEntityEscalations(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ["escalations", "entity", entityType, entityId],
    queryFn: () => getEntityEscalations(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });
}

export function useCreateEscalation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: EscalationCreate) => createEscalation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalations"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create escalation"),
  });
}

export function useUpdateEscalation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: EscalationUpdate }) =>
      updateEscalation(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["escalations"] });
      queryClient.invalidateQueries({ queryKey: ["escalations", variables.id] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update escalation"),
  });
}

export function useAcknowledgeEscalation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => acknowledgeEscalation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalations"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to acknowledge escalation"),
  });
}

export function useResolveEscalation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      resolveEscalation(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalations"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to resolve escalation"),
  });
}

export function useTriggerRiskCheck() {
  const queryClient = useQueryClient();
  return useMutation({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalations"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to trigger risk check"),
  });
}

export function useExportEscalations() {
  return useMutation({
    mutationFn: (params?: EscalationListParams) => exportEscalationsCsv(params),
    onError: (error: Error) => toast.error(error.message || "Failed to export escalations"),
  });
}
