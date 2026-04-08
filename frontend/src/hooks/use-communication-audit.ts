
import { useQuery } from "@tanstack/react-query";
import {
  getCommunicationAuditTrail,
  searchCommunicationAudits,
  getClientCommunicationPreferences,
  updateClientCommunicationPreferences,
  checkChannelAllowed,
} from "@/lib/api/communication-audit";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type {
  CommunicationAuditSearchParams,
  CommunicationPreferencesUpdate,
} from "@/types/communication-audit";

export function useCommunicationAuditTrail(
  communicationId: string,
  params?: { skip?: number; limit?: number }
) {
  return useQuery({
    queryKey: queryKeys.communicationAudit.trail(communicationId, params),
    queryFn: () => getCommunicationAuditTrail(communicationId, params),
    enabled: !!communicationId,
  });
}

export function useCommunicationAuditSearch(
  params?: CommunicationAuditSearchParams
) {
  return useQuery({
    queryKey: queryKeys.communicationAudit.search(params),
    queryFn: () => searchCommunicationAudits(params),
  });
}

export function useClientCommunicationPreferences(clientId: string) {
  return useQuery({
    queryKey: queryKeys.communicationAudit.clientPreferences(clientId),
    queryFn: () => getClientCommunicationPreferences(clientId),
    enabled: !!clientId,
  });
}

export function useUpdateClientCommunicationPreferences(clientId: string) {
  return useCrudMutation({
    mutationFn: (data: CommunicationPreferencesUpdate) =>
      updateClientCommunicationPreferences(clientId, data),
    invalidateKeys: [queryKeys.communicationAudit.clientPreferences(clientId)],
    successMessage: "Communication preferences updated",
    errorMessage: "Failed to update communication preferences",
  });
}

export function useCheckChannelAllowed(clientId: string, channel: string) {
  return useQuery({
    queryKey: queryKeys.communicationAudit.channelCheck(clientId, channel),
    queryFn: () => checkChannelAllowed(clientId, channel),
    enabled: !!clientId && !!channel,
  });
}
