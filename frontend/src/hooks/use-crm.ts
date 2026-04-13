import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import {
  convertLead,
  createLead,
  deleteLead,
  getLead,
  listLeads,
  updateLead,
} from "@/lib/api/leads";
import {
  createOpportunity,
  deleteOpportunity,
  getOpportunity,
  getPipelineSummary,
  listOpportunities,
  reorderOpportunity,
  updateOpportunity,
} from "@/lib/api/opportunities";
import {
  createCrmActivity,
  deleteCrmActivity,
  listCrmActivities,
  updateCrmActivity,
  type CrmActivityListParams,
} from "@/lib/api/crm-activities";
import type {
  LeadConvertRequest,
  LeadCreateData,
  LeadListParams,
  LeadUpdateData,
  OpportunityCreateData,
  OpportunityListParams,
  OpportunityReorderRequest,
  OpportunityUpdateData,
  CrmActivityCreateData,
  CrmActivityUpdateData,
} from "@/types/crm";

export function useLeads(params?: LeadListParams) {
  return useQuery({
    queryKey: queryKeys.crm.leads.list(params),
    queryFn: () => listLeads(params),
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: queryKeys.crm.leads.detail(id),
    queryFn: () => getLead(id),
    enabled: !!id,
  });
}

export function useCreateLead() {
  return useCrudMutation({
    mutationFn: (data: LeadCreateData) => createLead(data),
    invalidateKeys: [queryKeys.crm.leads.all],
    successMessage: "Lead created",
    errorMessage: "Failed to create lead",
  });
}

export function useUpdateLead(id: string) {
  return useCrudMutation({
    mutationFn: (data: LeadUpdateData) => updateLead(id, data),
    invalidateKeys: [queryKeys.crm.leads.all],
    successMessage: "Lead updated",
    errorMessage: "Failed to update lead",
  });
}

export function useDeleteLead() {
  return useCrudMutation({
    mutationFn: (id: string) => deleteLead(id),
    invalidateKeys: [queryKeys.crm.leads.all],
    successMessage: "Lead deleted",
    errorMessage: "Failed to delete lead",
  });
}

export function useConvertLead(id: string) {
  return useCrudMutation({
    mutationFn: (data: LeadConvertRequest) => convertLead(id, data),
    invalidateKeys: [queryKeys.crm.leads.all, queryKeys.clients.all],
    successMessage: "Lead converted to client",
    errorMessage: "Failed to convert lead",
  });
}

export function useOpportunities(params?: OpportunityListParams) {
  return useQuery({
    queryKey: queryKeys.crm.opportunities.list(params),
    queryFn: () => listOpportunities(params),
  });
}

export function useOpportunity(id: string) {
  return useQuery({
    queryKey: queryKeys.crm.opportunities.detail(id),
    queryFn: () => getOpportunity(id),
    enabled: !!id,
  });
}

export function usePipelineSummary() {
  return useQuery({
    queryKey: queryKeys.crm.opportunities.pipelineSummary(),
    queryFn: getPipelineSummary,
  });
}

export function useCreateOpportunity() {
  return useCrudMutation({
    mutationFn: (data: OpportunityCreateData) => createOpportunity(data),
    invalidateKeys: [queryKeys.crm.opportunities.all],
    successMessage: "Opportunity created",
    errorMessage: "Failed to create opportunity",
  });
}

export function useUpdateOpportunity(id: string) {
  return useCrudMutation({
    mutationFn: (data: OpportunityUpdateData) => updateOpportunity(id, data),
    invalidateKeys: [queryKeys.crm.opportunities.all],
    successMessage: "Opportunity updated",
    errorMessage: "Failed to update opportunity",
  });
}

export function useDeleteOpportunity() {
  return useCrudMutation({
    mutationFn: (id: string) => deleteOpportunity(id),
    invalidateKeys: [queryKeys.crm.opportunities.all],
    successMessage: "Opportunity deleted",
    errorMessage: "Failed to delete opportunity",
  });
}

export function useReorderOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: OpportunityReorderRequest;
    }) => reorderOpportunity(id, data),
    onError: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.opportunities.all });
      toast.error("Failed to move opportunity");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.opportunities.all });
    },
  });
}

export function useCrmActivities(params?: CrmActivityListParams) {
  return useQuery({
    queryKey: queryKeys.crm.activities.list(params),
    queryFn: () => listCrmActivities(params),
    enabled:
      !!params?.lead_id || !!params?.opportunity_id || !!params?.client_profile_id,
  });
}

export function useCreateCrmActivity() {
  return useCrudMutation({
    mutationFn: (data: CrmActivityCreateData) => createCrmActivity(data),
    invalidateKeys: [queryKeys.crm.activities.all],
    successMessage: "Activity logged",
    errorMessage: "Failed to log activity",
  });
}

export function useUpdateCrmActivity(id: string) {
  return useCrudMutation({
    mutationFn: (data: CrmActivityUpdateData) => updateCrmActivity(id, data),
    invalidateKeys: [queryKeys.crm.activities.all],
    errorMessage: "Failed to update activity",
  });
}

export function useDeleteCrmActivity() {
  return useCrudMutation({
    mutationFn: (id: string) => deleteCrmActivity(id),
    invalidateKeys: [queryKeys.crm.activities.all],
    errorMessage: "Failed to delete activity",
  });
}
