
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listPartners,
  getPartner,
  createPartner,
  updatePartner,
  provisionPartner,
} from "@/lib/api/partners";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type {
  PartnerListParams,
  PartnerCreateData,
  PartnerUpdateData,
  PartnerProvisionData,
} from "@/lib/api/partners";

export function usePartners(params?: PartnerListParams) {
  return useQuery({
    queryKey: queryKeys.partners.list(params),
    queryFn: () => listPartners(params),
  });
}

export function usePartner(id: string) {
  return useQuery({
    queryKey: queryKeys.partners.detail(id),
    queryFn: () => getPartner(id),
    enabled: !!id,
  });
}

export function useCreatePartner() {
  return useCrudMutation({
    mutationFn: (data: PartnerCreateData) => createPartner(data),
    invalidateKeys: [queryKeys.partners.all],
    errorMessage: "Failed to create partner",
  });
}

export function useUpdatePartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PartnerUpdateData }) =>
      updatePartner(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.partners.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.partners.detail(variables.id) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.partners.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.partners.detail(variables.id) });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to provision partner"),
  });
}
