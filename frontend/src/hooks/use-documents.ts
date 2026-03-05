"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listDocuments, uploadDocument, deleteDocument } from "@/lib/api/documents";

export function useDocuments(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ["documents", entityType, entityId],
    queryFn: () => listDocuments({ entity_type: entityType, entity_id: entityId }),
    enabled: !!entityType && !!entityId,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to upload document"),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete document"),
  });
}
