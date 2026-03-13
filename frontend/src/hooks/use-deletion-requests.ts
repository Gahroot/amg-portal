"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listDeletionRequests,
  getDeletionRequest,
  createDeletionRequest,
  approveDeletionRequest,
  rejectDeletionRequest,
} from "@/lib/api/deletion-requests";
import type {
  DeletionRequestCreateData,
  DeletionRequestRejectData,
} from "@/types/deletion-request";

export function useDeletionRequests(params?: {
  status?: string;
  entity_type?: string;
  skip?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["deletion-requests", params],
    queryFn: () => listDeletionRequests(params),
  });
}

export function useDeletionRequest(id: string) {
  return useQuery({
    queryKey: ["deletion-request", id],
    queryFn: () => getDeletionRequest(id),
    enabled: !!id,
  });
}

export function useCreateDeletionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DeletionRequestCreateData) =>
      createDeletionRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deletion-requests"] });
      toast.success("Deletion request submitted for review");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create deletion request"),
  });
}

export function useApproveDeletionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approveDeletionRequest(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["deletion-request", id] });
      queryClient.invalidateQueries({ queryKey: ["deletion-requests"] });
      toast.success("Deletion request approved");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to approve deletion request"),
  });
}

export function useRejectDeletionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DeletionRequestRejectData }) =>
      rejectDeletionRequest(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["deletion-request", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["deletion-requests"] });
      toast.success("Deletion request rejected");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to reject deletion request"),
  });
}
