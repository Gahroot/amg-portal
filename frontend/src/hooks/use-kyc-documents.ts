"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listKYCDocuments,
  uploadKYCDocument,
  verifyKYCDocument,
  listExpiringKYCDocuments,
} from "@/lib/api/kyc-documents";
import type { KYCVerifyData } from "@/types/document";

export function useKYCDocuments(clientId: string) {
  return useQuery({
    queryKey: ["kyc-documents", clientId],
    queryFn: () => listKYCDocuments(clientId),
    enabled: !!clientId,
  });
}

export function useUploadKYCDocument(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      file: File;
      documentType: string;
      expiryDate?: string;
      notes?: string;
    }) =>
      uploadKYCDocument(clientId, params.file, params.documentType, params.expiryDate, params.notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kyc-documents"] });
    },
  });
}

export function useVerifyKYCDocument(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { kycId: string; data: KYCVerifyData }) =>
      verifyKYCDocument(clientId, params.kycId, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kyc-documents"] });
    },
  });
}

export function useExpiringKYCDocuments(days?: number) {
  return useQuery({
    queryKey: ["kyc-documents", "expiring", days],
    queryFn: () => listExpiringKYCDocuments(days),
  });
}
