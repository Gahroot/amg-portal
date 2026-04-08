
import { useQuery } from "@tanstack/react-query";
import {
  listSLATrackers,
  getSLABreaches,
  startSLAClock,
  respondToSLA,
  getEntitySLATrackers,
} from "@/lib/api/sla";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type { SLACreate, SLAListParams } from "@/types/sla";

export function useSLATrackers(params?: SLAListParams) {
  return useQuery({
    queryKey: queryKeys.sla.list(params),
    queryFn: () => listSLATrackers(params),
  });
}

export function useSLABreaches(includeApproaching = true) {
  return useQuery({
    queryKey: queryKeys.sla.breaches(includeApproaching),
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
    queryKey: queryKeys.sla.entity(entityType, entityId, params),
    queryFn: () => getEntitySLATrackers(entityType, entityId, params),
    enabled: !!entityType && !!entityId,
  });
}

export function useStartSLA() {
  return useCrudMutation({
    mutationFn: (data: SLACreate) => startSLAClock(data),
    invalidateKeys: [queryKeys.sla.all],
    errorMessage: "Failed to start SLA tracker",
  });
}

export function useRespondToSLA() {
  return useCrudMutation({
    mutationFn: (id: string) => respondToSLA(id),
    invalidateKeys: [queryKeys.sla.all],
    errorMessage: "Failed to respond to SLA",
  });
}
