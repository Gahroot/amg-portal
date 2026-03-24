import api from "@/lib/api";

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

export async function createSavedFilter(
  data: SavedFilterCreateData
): Promise<SavedFilter> {
  const response = await api.post<SavedFilter>("/api/v1/saved-filters", data);
  return response.data;
}

export async function updateSavedFilter(
  id: string,
  data: SavedFilterUpdateData
): Promise<SavedFilter> {
  const response = await api.put<SavedFilter>(
    `/api/v1/saved-filters/${id}`,
    data
  );
  return response.data;
}

export async function deleteSavedFilter(id: string): Promise<void> {
  await api.delete(`/api/v1/saved-filters/${id}`);
}
