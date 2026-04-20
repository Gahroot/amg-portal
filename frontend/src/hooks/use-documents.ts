
import { useQuery } from "@tanstack/react-query";
import {
  compareDocumentVersions,
  listDocuments,
  uploadDocument,
  deleteDocument,
  getDocumentVersions,
  listVaultDocuments,
  getCustodyChain,
  getDocumentDeliveries,
  sealDocument,
  deliverDocument,
  listExpiringDocuments,
} from "@/lib/api/documents";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";

export function useDocuments(entityType: string, entityId: string) {
  return useQuery({
    queryKey: queryKeys.documents.entity(entityType, entityId),
    queryFn: () => listDocuments({ entity_type: entityType, entity_id: entityId }),
    enabled: !!entityType && !!entityId,
  });
}

export function useUploadDocument() {
  return useCrudMutation({
    mutationFn: (params: {
      file: File;
      entityType: string;
      entityId: string;
      category?: string;
      description?: string;
    }) =>
      uploadDocument(
        params.file,
        params.entityType,
        params.entityId,
        params.category,
        params.description,
      ),
    invalidateKeys: [queryKeys.documents.all],
    errorMessage: "Failed to upload document",
  });
}

export function useDeleteDocument() {
  return useCrudMutation({
    mutationFn: (id: string) => deleteDocument(id),
    invalidateKeys: [queryKeys.documents.all],
    errorMessage: "Failed to delete document",
  });
}

export function useDocumentVersions(documentId: string, enabled = false) {
  return useQuery({
    queryKey: queryKeys.documents.versions(documentId),
    queryFn: () => getDocumentVersions(documentId),
    enabled: !!documentId && enabled,
  });
}

export function useVaultDocuments(vaultStatus?: string) {
  return useQuery({
    queryKey: queryKeys.documents.vault(vaultStatus),
    queryFn: () => listVaultDocuments({ vault_status: vaultStatus }),
  });
}

export function useCustodyChain(documentId: string, enabled = false) {
  return useQuery({
    queryKey: queryKeys.documents.custodyChain(documentId),
    queryFn: () => getCustodyChain(documentId),
    enabled: !!documentId && enabled,
  });
}

export function useDocumentDeliveries(documentId: string, enabled = false) {
  return useQuery({
    queryKey: queryKeys.documents.deliveries(documentId),
    queryFn: () => getDocumentDeliveries(documentId),
    enabled: !!documentId && enabled,
  });
}

export function useSealDocument() {
  return useCrudMutation({
    mutationFn: (params: { documentId: string; retentionPolicy?: string }) =>
      sealDocument(params.documentId, { retention_policy: params.retentionPolicy }),
    invalidateKeys: [queryKeys.documents.all],
    successMessage: "Document sealed successfully",
    errorMessage: "Failed to seal document",
  });
}

export function useDeliverDocument() {
  return useCrudMutation({
    mutationFn: (params: {
      documentId: string;
      recipientIds: string[];
      method: "portal" | "email" | "secure_link";
      notes?: string;
    }) =>
      deliverDocument(params.documentId, {
        recipient_ids: params.recipientIds,
        delivery_method: params.method,
        notes: params.notes,
      }),
    invalidateKeys: [queryKeys.documents.all],
    successMessage: "Document delivered successfully",
    errorMessage: "Failed to deliver document",
  });
}

export function useExpiringDocuments(params?: {
  entity_type?: string;
  entity_id?: string;
  status?: "expired" | "expiring_30" | "expiring_90";
  skip?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: queryKeys.documents.expiring(params),
    queryFn: () => listExpiringDocuments(params),
  });
}

export function useDocumentCompare(
  versionAId: string | null,
  versionBId: string | null,
  enabled = false,
) {
  return useQuery({
    queryKey: queryKeys.documents.compare(versionAId, versionBId),
    queryFn: () => compareDocumentVersions(versionAId!, versionBId!),
    enabled: !!versionAId && !!versionBId && enabled,
  });
}
