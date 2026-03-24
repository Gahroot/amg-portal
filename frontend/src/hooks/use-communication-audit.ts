
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getCommunicationAuditTrail,
  searchCommunicationAudits,
  getClientCommunicationPreferences,
  updateClientCommunicationPreferences,
  checkChannelAllowed,
} from "@/lib/api/communication-audit";
import type {
  CommunicationAuditSearchParams,
  CommunicationPreferencesUpdate,
} from "@/types/communication-audit";

export function useCommunicationAuditTrail(
  communicationId: string,
  params?: { skip?: number; limit?: number }
) {
  return useQuery({
    queryKey: ["communication-audit", communicationId, params],
    queryFn: () => getCommunicationAuditTrail(communicationId, params),
    enabled: !!communicationId,
  });
}

export function useCommunicationAuditSearch(
  params?: CommunicationAuditSearchParams
) {
  return useQuery({
    queryKey: ["communication-audit", "search", params],
    queryFn: () => searchCommunicationAudits(params),
  });
}

export function useClientCommunicationPreferences(clientId: string) {
  return useQuery({
    queryKey: ["client-communication-preferences", clientId],
    queryFn: () => getClientCommunicationPreferences(clientId),
    enabled: !!clientId,
  });
}

export function useUpdateClientCommunicationPreferences(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CommunicationPreferencesUpdate) =>
      updateClientCommunicationPreferences(clientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["client-communication-preferences", clientId],
      });
      toast.success("Communication preferences updated");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update communication preferences"),
  });
}

export function useCheckChannelAllowed(clientId: string, channel: string) {
  return useQuery({
    queryKey: ["channel-check", clientId, channel],
    queryFn: () => checkChannelAllowed(clientId, channel),
    enabled: !!clientId && !!channel,
  });
}
