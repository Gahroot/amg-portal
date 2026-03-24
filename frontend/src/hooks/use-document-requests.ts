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
import type { DocumentRequestCreate, DocumentRequestUpdate } from "@/types/document";

// ── Internal (staff) hooks ────────────────────────────────────────────────────

export function useDocumentRequests(clientId?: string, status?: string) {
  return useQuery({
    queryKey: ["document-requests", clientId, status],
    queryFn: () => listDocumentRequests({ client_id: clientId, status }),
  });
}

export function useCreateDocumentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DocumentRequestCreate) => createDocumentRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-requests"] });
      toast.success("Document request sent to client");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to send document request"),
  });
}

export function useUpdateDocumentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DocumentRequestUpdate }) =>
      updateDocumentRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-requests"] });
      toast.success("Request updated");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update request"),
  });
}

export function useCancelDocumentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelDocumentRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-requests"] });
      toast.success("Request cancelled");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to cancel request"),
  });
}

export function useSendDocumentRequestReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sendDocumentRequestReminder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-requests"] });
      toast.success("Reminder sent to client");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to send reminder"),
  });
}

// ── Portal (client) hooks ─────────────────────────────────────────────────────

export function useMyDocumentRequests(status?: string) {
  return useQuery({
    queryKey: ["portal", "document-requests", status],
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
      queryClient.invalidateQueries({ queryKey: ["portal", "document-requests"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "documents"] });
      toast.success("Document uploaded successfully");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to upload document"),
  });
}

export function useCancelMyDocumentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => cancelMyDocumentRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "document-requests"] });
      toast.success("Request cancelled");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to cancel request"),
  });
}

export function useAddNoteToDocumentRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, note }: { requestId: string; note: string }) =>
      addNoteToMyDocumentRequest(requestId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "document-requests"] });
      toast.success("Note saved");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save note"),
  });
}
