"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listCommunicationLogs,
  getCommunicationLog,
  createCommunicationLog,
  updateCommunicationLog,
  deleteCommunicationLog,
} from "@/lib/api/communication-logs";
import type {
  CommunicationLogCreateData,
  CommunicationLogUpdateData,
  CommunicationLogListParams,
} from "@/types/communication-log";

export function useCommunicationLogs(params?: CommunicationLogListParams) {
  return useQuery({
    queryKey: ["communication-logs", params],
    queryFn: () => listCommunicationLogs(params),
  });
}

export function useCommunicationLog(id: string) {
  return useQuery({
    queryKey: ["communication-logs", id],
    queryFn: () => getCommunicationLog(id),
    enabled: !!id,
  });
}

export function useCreateCommunicationLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CommunicationLogCreateData) => createCommunicationLog(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communication-logs"] });
      toast.success("Communication log created");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create communication log"),
  });
}

export function useUpdateCommunicationLog(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CommunicationLogUpdateData) => updateCommunicationLog(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communication-logs"] });
      toast.success("Communication log updated");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update communication log"),
  });
}

export function useDeleteCommunicationLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCommunicationLog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communication-logs"] });
      toast.success("Communication log deleted");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to delete communication log"),
  });
}
