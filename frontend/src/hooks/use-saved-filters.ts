import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getSavedFilters,
  createSavedFilter,
  updateSavedFilter,
  deleteSavedFilter,
} from "@/lib/api/saved-filters";
import type {
  SavedFilterCreateData,
  SavedFilterUpdateData,
} from "@/lib/api/saved-filters";

const QUERY_KEY = ["saved-filters"];

export function useSavedFilters(entityType: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, entityType],
    queryFn: () => getSavedFilters(entityType),
  });
}

export function useCreateSavedFilter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SavedFilterCreateData) => createSavedFilter(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Filter preset saved");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to save filter preset"),
  });
}

export function useUpdateSavedFilter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SavedFilterUpdateData }) =>
      updateSavedFilter(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Filter preset updated");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update filter preset"),
  });
}

export function useDeleteSavedFilter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSavedFilter(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Filter preset deleted");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to delete filter preset"),
  });
}
