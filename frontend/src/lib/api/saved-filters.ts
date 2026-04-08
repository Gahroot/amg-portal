import api from "@/lib/api";
import { createApiClient } from "./factory";

export interface SavedFilter {
  id: string;
  user_id: string;
  name: string;
  entity_type: string;
  filter_config: Record<string, string>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavedFilterListResponse {
  items: SavedFilter[];
  total: number;
}

export interface SavedFilterCreateData {
  name: string;
  entity_type: string;
  filter_config: Record<string, string>;
  is_default?: boolean;
}

export interface SavedFilterUpdateData {
  name?: string;
  filter_config?: Record<string, string>;
  is_default?: boolean;
}

const filtersApi = createApiClient<
  SavedFilter,
  SavedFilterListResponse,
  SavedFilterCreateData,
  SavedFilterUpdateData
>("/api/v1/saved-filters", { updateMethod: "put" });

export const createSavedFilter = filtersApi.create;
export const updateSavedFilter = filtersApi.update;
export const deleteSavedFilter = filtersApi.delete;

// getSavedFilters has custom param handling
export async function getSavedFilters(
  entityType?: string
): Promise<SavedFilterListResponse> {
  const params: Record<string, string> = {};
  if (entityType) {
    params.entity_type = entityType;
  }
  const response = await api.get<SavedFilterListResponse>(
    "/api/v1/saved-filters",
    { params }
  );
  return response.data;
}
