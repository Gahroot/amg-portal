"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "@/lib/api/clients";
import type {
  ClientProfileCreateData,
  ClientProfileUpdateData,
  ComplianceReviewData,
  MDApprovalData,
  ClientProvisionData,
  ClientListParams,
} from "@/types/client";

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
  });
}

export function useMDApproval(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MDApprovalData) => submitMDApproval(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useProvisionClient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ClientProvisionData) => provisionClient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
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
