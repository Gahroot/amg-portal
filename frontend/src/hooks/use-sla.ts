"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSLATrackers,
  getSLABreaches,
  startSLAClock,
  respondToSLA,
  getEntitySLATrackers,
} from "@/lib/api/sla";
import type { SLACreate, SLAListParams } from "@/types/sla";

export function useSLATrackers(params?: SLAListParams) {
  return useQuery({
    queryKey: ["sla", params],
    queryFn: () => listSLATrackers(params),
  });
}

export function useSLABreaches(includeApproaching = true) {
  return useQuery({
    queryKey: ["sla", "breaches", includeApproaching],
    queryFn: () => getSLABreaches(includeApproaching),
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

export function useEntitySLATrackers(
  entityType: string,
  entityId: string,
  params?: SLAListParams,
) {
  return useQuery({
    queryKey: ["sla", "entity", entityType, entityId, params],
    queryFn: () => getEntitySLATrackers(entityType, entityId, params),
    enabled: !!entityType && !!entityId,
  });
}

export function useStartSLA() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SLACreate) => startSLAClock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla"] });
    },
  });
}

export function useRespondToSLA() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => respondToSLA(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla"] });
      queryClient.invalidateQueries({ queryKey: ["sla", "breaches"] });
    },
  });
}
