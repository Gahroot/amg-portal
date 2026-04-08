
import { useQuery } from "@tanstack/react-query";
import {
  listCommunicationLogs,
  getCommunicationLog,
  createCommunicationLog,
  updateCommunicationLog,
  deleteCommunicationLog,
} from "@/lib/api/communication-logs";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type {
  CommunicationLogCreateData,
  CommunicationLogUpdateData,
  CommunicationLogListParams,
} from "@/types/communication-log";

export function useCommunicationLogs(params?: CommunicationLogListParams) {
  return useQuery({
    queryKey: queryKeys.communicationLogs.list(params),
    queryFn: () => listCommunicationLogs(params),
  });
}

export function useCommunicationLog(id: string) {
  return useQuery({
    queryKey: queryKeys.communicationLogs.detail(id),
    queryFn: () => getCommunicationLog(id),
    enabled: !!id,
  });
}

export function useCreateCommunicationLog() {
  return useCrudMutation({
    mutationFn: (data: CommunicationLogCreateData) => createCommunicationLog(data),
    invalidateKeys: [queryKeys.communicationLogs.all],
    successMessage: "Communication log created",
    errorMessage: "Failed to create communication log",
  });
}

export function useUpdateCommunicationLog(id: string) {
  return useCrudMutation({
    mutationFn: (data: CommunicationLogUpdateData) => updateCommunicationLog(id, data),
    invalidateKeys: [queryKeys.communicationLogs.all],
    successMessage: "Communication log updated",
    errorMessage: "Failed to update communication log",
  });
}

export function useDeleteCommunicationLog() {
  return useCrudMutation({
    mutationFn: (id: string) => deleteCommunicationLog(id),
    invalidateKeys: [queryKeys.communicationLogs.all],
    successMessage: "Communication log deleted",
    errorMessage: "Failed to delete communication log",
  });
}
