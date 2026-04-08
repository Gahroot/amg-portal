
import { useQuery } from "@tanstack/react-query";
import {
  acknowledgePortalDocument,
  getMyPortalDocument,
  getMyPortalDocuments,
} from "@/lib/api/client-portal";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";

export function usePortalDocuments() {
  return useQuery({
    queryKey: queryKeys.portal.documents.all,
    queryFn: getMyPortalDocuments,
  });
}

export function usePortalDocument(id: string) {
  return useQuery({
    queryKey: queryKeys.portal.documents.detail(id),
    queryFn: () => getMyPortalDocument(id),
    enabled: !!id,
  });
}

export function useAcknowledgeDocument() {
  return useCrudMutation({
    mutationFn: ({ documentId, signerName }: { documentId: string; signerName: string }) =>
      acknowledgePortalDocument(documentId, signerName),
    invalidateKeys: [queryKeys.portal.documents.all],
    successMessage: "Document acknowledged successfully.",
    errorMessage: "Failed to acknowledge document",
  });
}
