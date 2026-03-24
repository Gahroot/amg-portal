
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  acknowledgePortalDocument,
  getMyPortalDocument,
  getMyPortalDocuments,
} from "@/lib/api/client-portal";

export function usePortalDocuments() {
  return useQuery({
    queryKey: ["portal", "documents"],
    queryFn: getMyPortalDocuments,
  });
}

export function usePortalDocument(id: string) {
  return useQuery({
    queryKey: ["portal", "documents", id],
    queryFn: () => getMyPortalDocument(id),
    enabled: !!id,
  });
}

export function useAcknowledgeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, signerName }: { documentId: string; signerName: string }) =>
      acknowledgePortalDocument(documentId, signerName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "documents"] });
      toast.success("Document acknowledged successfully.");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to acknowledge document"),
  });
}
