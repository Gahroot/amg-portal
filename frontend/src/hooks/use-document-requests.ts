import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addNoteToMyDocumentRequest,
  cancelDocumentRequest,
  cancelMyDocumentRequest,
  createDocumentRequest,
  fulfillMyDocumentRequest,
  getMyDocumentRequests,
  listDocumentRequests,
  sendDocumentRequestReminder,
  updateDocumentRequest,
} from "@/lib/api/documents";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type { DocumentRequestCreate, DocumentRequestUpdate } from "@/types/document";

// ── Internal (staff) hooks ────────────────────────────────────────────────────

export function useDocumentRequests(clientId?: string, status?: string) {
  return useQuery({
    queryKey: queryKeys.documentRequests.list(clientId, status),
    queryFn: () => listDocumentRequests({ client_id: clientId, status }),
  });
}

export function useCreateDocumentRequest() {
  return useCrudMutation({
    mutationFn: (data: DocumentRequestCreate) => createDocumentRequest(data),
    invalidateKeys: [queryKeys.documentRequests.all],
    successMessage: "Document request sent to client",
    errorMessage: "Failed to send document request",
  });
}

export function useUpdateDocumentRequest() {
  return useCrudMutation({
    mutationFn: ({ id, data }: { id: string; data: DocumentRequestUpdate }) =>
      updateDocumentRequest(id, data),
    invalidateKeys: [queryKeys.documentRequests.all],
    successMessage: "Request updated",
    errorMessage: "Failed to update request",
  });
}

export function useCancelDocumentRequest() {
  return useCrudMutation({
    mutationFn: (id: string) => cancelDocumentRequest(id),
    invalidateKeys: [queryKeys.documentRequests.all],
    successMessage: "Request cancelled",
    errorMessage: "Failed to cancel request",
  });
}

export function useSendDocumentRequestReminder() {
  return useCrudMutation({
    mutationFn: (id: string) => sendDocumentRequestReminder(id),
    invalidateKeys: [queryKeys.documentRequests.all],
    successMessage: "Reminder sent to client",
    errorMessage: "Failed to send reminder",
  });
}

// ── Portal (client) hooks ─────────────────────────────────────────────────────

export function useMyDocumentRequests(status?: string) {
  return useQuery({
    queryKey: queryKeys.portal.documentRequests(status),
    queryFn: () => getMyDocumentRequests(status),
  });
}

export function useFulfillDocumentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      file,
      category,
      description,
    }: {
      requestId: string;
      file: File;
      category?: string;
      description?: string;
    }) => fulfillMyDocumentRequest(requestId, file, category, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.portal.documentRequests() });
      queryClient.invalidateQueries({ queryKey: queryKeys.portal.documents.all });
      toast.success("Document uploaded successfully");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to upload document"),
  });
}

export function useCancelMyDocumentRequest() {
  return useCrudMutation({
    mutationFn: (requestId: string) => cancelMyDocumentRequest(requestId),
    invalidateKeys: [queryKeys.portal.documentRequests()],
    successMessage: "Request cancelled",
    errorMessage: "Failed to cancel request",
  });
}

export function useAddNoteToDocumentRequest() {
  return useCrudMutation({
    mutationFn: ({ requestId, note }: { requestId: string; note: string }) =>
      addNoteToMyDocumentRequest(requestId, note),
    invalidateKeys: [queryKeys.portal.documentRequests()],
    successMessage: "Note saved",
    errorMessage: "Failed to save note",
  });
}
