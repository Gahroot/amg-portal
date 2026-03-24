
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
    queryKey: ["clients", params],
    queryFn: () => listClientProfiles(params),
  });
}

export function useClientProfile(id: string) {
  return useQuery({
    queryKey: ["clients", id],
    queryFn: () => getClientProfile(id),
    enabled: !!id,
  });
}

export function useClients(params?: ClientListParams) {
  return useQuery({
    queryKey: ["clients", "list", params],
    queryFn: () => listClients(params),
  });
}

export function useCreateClientProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ClientProfileCreateData) => createClientProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create client"),
  });
}

export function useUpdateClientProfile(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ClientProfileUpdateData) =>
      updateClientProfile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update client"),
  });
}

export function useUpdateIntelligenceFile(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: IntelligenceFile) =>
      updateIntelligenceFile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", id] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update intelligence file"),
  });
}

export function useComplianceReview(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ComplianceReviewData) =>
      submitComplianceReview(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to submit compliance review"),
  });
}

export function useMDApproval(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MDApprovalData) => submitMDApproval(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to submit approval"),
  });
}

export function useProvisionClient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ClientProvisionData) => provisionClient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to provision client"),
  });
}

export function useMyPortfolio(params?: { skip?: number; limit?: number }) {
  return useQuery({
    queryKey: ["clients", "portfolio", params],
    queryFn: () => getMyPortfolio(params),
  });
}

export function usePortalProfile() {
  return useQuery({
    queryKey: ["portal", "profile"],
    queryFn: () => getPortalProfile(),
  });
}

export function useComplianceCertificate(id: string) {
  return useQuery({
    queryKey: ["clients", id, "certificate"],
    queryFn: () => getComplianceCertificate(id),
    enabled: false,
  });
}

// ---------------------------------------------------------------------------
// Security & Intelligence Feed hooks — need-to-know (MD + RM only)
// ---------------------------------------------------------------------------

export function useSecurityBrief(id: string, enabled = true) {
  return useQuery({
    queryKey: ["clients", id, "security-brief"],
    queryFn: () => getSecurityBrief(id),
    enabled: !!id && enabled,
    retry: false,
  });
}

export function useUpdateSecurityProfileLevel(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SecurityProfileLevelUpdate) =>
      updateSecurityProfileLevel(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", id] });
      toast.success("Security profile level updated");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update security profile level"),
  });
}

// ---------------------------------------------------------------------------
// Client dates (birthdays & important dates)
// ---------------------------------------------------------------------------

export function useUpcomingDates(daysAhead = 14) {
  return useQuery({
    queryKey: ["clients", "upcoming-dates", daysAhead],
    queryFn: () => getUpcomingDates({ days_ahead: daysAhead }),
    refetchInterval: 60_000,
  });
}

export function useUpdateClientDates(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ClientProfileUpdateData) => updateClientProfile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", id] });
      queryClient.invalidateQueries({ queryKey: ["clients", "upcoming-dates"] });
      toast.success("Dates saved");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save dates"),
  });
}
