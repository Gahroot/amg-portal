import { useQuery } from "@tanstack/react-query";
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
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";

export function useSavedFilters(entityType: string) {
  return useQuery({
    queryKey: queryKeys.savedFilters.byEntity(entityType),
    queryFn: () => getSavedFilters(entityType),
  });
}

export function useCreateSavedFilter() {
  return useCrudMutation({
    mutationFn: (data: SavedFilterCreateData) => createSavedFilter(data),
    invalidateKeys: [queryKeys.savedFilters.all],
    successMessage: "Filter preset saved",
    errorMessage: "Failed to save filter preset",
  });
}

export function useUpdateSavedFilter() {
  return useCrudMutation({
    mutationFn: ({ id, data }: { id: string; data: SavedFilterUpdateData }) =>
      updateSavedFilter(id, data),
    invalidateKeys: [queryKeys.savedFilters.all],
    successMessage: "Filter preset updated",
    errorMessage: "Failed to update filter preset",
  });
}

export function useDeleteSavedFilter() {
  return useCrudMutation({
    mutationFn: (id: string) => deleteSavedFilter(id),
    invalidateKeys: [queryKeys.savedFilters.all],
    successMessage: "Filter preset deleted",
    errorMessage: "Failed to delete filter preset",
  });
}
