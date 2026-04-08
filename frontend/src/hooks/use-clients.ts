
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listClientProfiles,
  listClients,
  getClientProfile,
  createClientProfile,
  updateClientProfile,
  updateIntelligenceFile,
  submitComplianceReview,
  submitMDApproval,
  provisionClient,
  getMyPortfolio,
  getPortalProfile,
  getComplianceCertificate,
  getSecurityBrief,
  updateSecurityProfileLevel,
  getUpcomingDates,
} from "@/lib/api/clients";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type {
  ClientProfileCreateData,
  ClientProfileUpdateData,
  ComplianceReviewData,
  IntelligenceFile,
  MDApprovalData,
  ClientProvisionData,
  ClientListParams,
  SecurityProfileLevelUpdate,
} from "@/types/client";

// Re-export for convenience
export type { ClientProfileUpdateData };

export function useClientProfiles(params?: ClientListParams) {
  return useQuery({
    queryKey: queryKeys.clients.profiles(params),
    queryFn: () => listClientProfiles(params),
  });
}

export function useClientProfile(id: string) {
  return useQuery({
    queryKey: queryKeys.clients.profile(id),
    queryFn: () => getClientProfile(id),
    enabled: !!id,
  });
}

export function useClients(params?: ClientListParams) {
  return useQuery({
    queryKey: queryKeys.clients.list(params),
    queryFn: () => listClients(params),
  });
}

export function useCreateClientProfile() {
  return useCrudMutation({
    mutationFn: (data: ClientProfileCreateData) => createClientProfile(data),
    invalidateKeys: [queryKeys.clients.all],
    errorMessage: "Failed to create client",
  });
}

export function useUpdateClientProfile(id: string) {
  return useCrudMutation({
    mutationFn: (data: ClientProfileUpdateData) => updateClientProfile(id, data),
    invalidateKeys: [queryKeys.clients.all],
    errorMessage: "Failed to update client",
  });
}

export function useUpdateIntelligenceFile(id: string) {
  return useCrudMutation({
    mutationFn: (data: IntelligenceFile) => updateIntelligenceFile(id, data),
    invalidateKeys: [queryKeys.clients.profile(id)],
    errorMessage: "Failed to update intelligence file",
  });
}

export function useComplianceReview(id: string) {
  return useCrudMutation({
    mutationFn: (data: ComplianceReviewData) => submitComplianceReview(id, data),
    invalidateKeys: [queryKeys.clients.all],
    errorMessage: "Failed to submit compliance review",
  });
}

export function useMDApproval(id: string) {
  return useCrudMutation({
    mutationFn: (data: MDApprovalData) => submitMDApproval(id, data),
    invalidateKeys: [queryKeys.clients.all],
    errorMessage: "Failed to submit approval",
  });
}

export function useProvisionClient(id: string) {
  return useCrudMutation({
    mutationFn: (data: ClientProvisionData) => provisionClient(id, data),
    invalidateKeys: [queryKeys.clients.all],
    errorMessage: "Failed to provision client",
  });
}

export function useMyPortfolio(params?: { skip?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.clients.portfolio(params),
    queryFn: () => getMyPortfolio(params),
  });
}

export function usePortalProfile() {
  return useQuery({
    queryKey: queryKeys.portal.profile(),
    queryFn: () => getPortalProfile(),
  });
}

export function useComplianceCertificate(id: string) {
  return useQuery({
    queryKey: queryKeys.clients.certificate(id),
    queryFn: () => getComplianceCertificate(id),
    enabled: false,
  });
}

// ---------------------------------------------------------------------------
// Security & Intelligence Feed hooks — need-to-know (MD + RM only)
// ---------------------------------------------------------------------------

export function useSecurityBrief(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.clients.securityBrief(id),
    queryFn: () => getSecurityBrief(id),
    enabled: !!id && enabled,
    retry: false,
  });
}

export function useUpdateSecurityProfileLevel(id: string) {
  return useCrudMutation({
    mutationFn: (data: SecurityProfileLevelUpdate) =>
      updateSecurityProfileLevel(id, data),
    invalidateKeys: [queryKeys.clients.profile(id)],
    successMessage: "Security profile level updated",
    errorMessage: "Failed to update security profile level",
  });
}

// ---------------------------------------------------------------------------
// Client dates (birthdays & important dates)
// ---------------------------------------------------------------------------

export function useUpcomingDates(daysAhead = 14) {
  return useQuery({
    queryKey: queryKeys.clients.upcomingDates(daysAhead),
    queryFn: () => getUpcomingDates({ days_ahead: daysAhead }),
    refetchInterval: 60_000,
  });
}

export function useUpdateClientDates(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ClientProfileUpdateData) => updateClientProfile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.profile(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.upcomingDates() });
      toast.success("Dates saved");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save dates"),
  });
}
