"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listKYCAlerts,
  markKYCAlertRead,
  resolveKYCAlert,
} from "@/lib/api/kyc-alerts";
import type {
  KYCAlertListParams,
  KYCAlertResolveRequest,
} from "@/types/kyc-alert";

export function useKYCAlerts(params?: KYCAlertListParams) {
  return useQuery({
    queryKey: ["kyc-alerts", params],
    queryFn: () => listKYCAlerts(params),
  });
}

export function useMarkKYCAlertRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markKYCAlertRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kyc-alerts"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to mark alert as read"),
  });
}

export function useResolveKYCAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data?: KYCAlertResolveRequest;
    }) => resolveKYCAlert(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kyc-alerts"] });
      toast.success("Alert resolved");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to resolve alert"),
  });
}
