"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listClientProfiles,
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
  getPortalPrograms,
  getPortalProgramDetail,
  getPortalDecisions,
  respondToPortalDecision,
} from "@/lib/api/clients";
import type {
  ClientProfileCreateData,
  ClientProfileUpdateData,
  ComplianceReviewData,
  MDApprovalData,
  ClientProvisionData,
  ClientListParams,
} from "@/types/client";
import type { DecisionResponseData } from "@/types/communication";

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
    mutationFn: (data: Record<string, unknown>) =>
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

// --- Portal Programs ---

export function usePortalPrograms() {
  return useQuery({
    queryKey: ["portal", "programs"],
    queryFn: () => getPortalPrograms(),
  });
}

export function usePortalProgramDetail(id: string) {
  return useQuery({
    queryKey: ["portal", "programs", id],
    queryFn: () => getPortalProgramDetail(id),
    enabled: !!id,
  });
}

// --- Portal Decisions ---

export function usePortalDecisions(params?: {
  status?: string;
  skip?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["portal", "decisions", params],
    queryFn: () => getPortalDecisions(params),
  });
}

export function useRespondToPortalDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DecisionResponseData }) =>
      respondToPortalDecision(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "decisions"] });
      toast.success("Response submitted successfully");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to submit response"),
  });
}
