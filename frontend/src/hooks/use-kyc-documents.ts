
import { useQuery } from "@tanstack/react-query";
import {
  listKYCDocuments,
  uploadKYCDocument,
  verifyKYCDocument,
  listExpiringKYCDocuments,
} from "@/lib/api/kyc-documents";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type { KYCVerifyData } from "@/types/document";

export function useKYCDocuments(clientId: string) {
  return useQuery({
    queryKey: queryKeys.kycDocuments.byClient(clientId),
    queryFn: () => listKYCDocuments(clientId),
    enabled: !!clientId,
  });
}

export function useUploadKYCDocument(clientId: string) {
  return useCrudMutation({
    mutationFn: (params: {
      file: File;
      documentType: string;
      expiryDate?: string;
      notes?: string;
    }) =>
      uploadKYCDocument(clientId, params.file, params.documentType, params.expiryDate, params.notes),
    invalidateKeys: [queryKeys.kycDocuments.all],
    errorMessage: "Failed to upload KYC document",
  });
}

export function useVerifyKYCDocument(clientId: string) {
  return useCrudMutation({
    mutationFn: (params: { kycId: string; data: KYCVerifyData }) =>
      verifyKYCDocument(clientId, params.kycId, params.data),
    invalidateKeys: [queryKeys.kycDocuments.all],
    errorMessage: "Failed to verify document",
  });
}

export function useExpiringKYCDocuments(days?: number) {
  return useQuery({
    queryKey: queryKeys.kycDocuments.expiring(days),
    queryFn: () => listExpiringKYCDocuments(days),
  });
}
