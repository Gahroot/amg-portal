
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listPartners,
  getPartner,
  createPartner,
  updatePartner,
  provisionPartner,
} from "@/lib/api/partners";
import type {
  PartnerListParams,
  PartnerCreateData,
  PartnerUpdateData,
  PartnerProvisionData,
} from "@/lib/api/partners";

export function usePartners(params?: PartnerListParams) {
  return useQuery({
    queryKey: ["partners", params],
    queryFn: () => listPartners(params),
  });
}

export function usePartner(id: string) {
  return useQuery({
    queryKey: ["partners", id],
    queryFn: () => getPartner(id),
    enabled: !!id,
  });
}

export function useCreatePartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PartnerCreateData) => createPartner(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create partner"),
  });
}

export function useUpdatePartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PartnerUpdateData }) =>
      updatePartner(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partners", variables.id] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update partner"),
  });
}

export function useProvisionPartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: PartnerProvisionData;
    }) => provisionPartner(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partners", variables.id] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to provision partner"),
  });
}
