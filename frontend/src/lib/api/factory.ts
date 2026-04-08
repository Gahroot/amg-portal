/**
 * Typed factory for generating standard CRUD API functions.
 *
 * Most API files repeat the same `api.get/post/patch/delete -> response.data`
 * pattern. This factory eliminates that boilerplate while preserving full type
 * safety. Custom/non-standard endpoints should remain as manual functions in
 * the individual API files.
 */

import api from "@/lib/api";

interface CrudOptions {
  /** Use `put` instead of `patch` for the update method (default: `patch`). */
  updateMethod?: "patch" | "put";
}

/**
 * Create a typed CRUD API client for a given base path.
 *
 * @typeParam TEntity       - The entity type returned by get/create/update
 * @typeParam TListResponse - The response type returned by list (often paginated)
 * @typeParam TCreateData   - The data shape for creating an entity
 * @typeParam TUpdateData   - The data shape for updating an entity (defaults to Partial<TCreateData>)
 */
export function createApiClient<
  TEntity,
  TListResponse = TEntity[],
  TCreateData = Record<string, unknown>,
  TUpdateData = Partial<TCreateData>,
>(basePath: string, options?: CrudOptions) {
  const method = options?.updateMethod ?? "patch";
  // Strip trailing slash so `${base}/${id}` never produces a double-slash
  const base = basePath.replace(/\/+$/, "");

  return {
    list: async (params?: Record<string, unknown>): Promise<TListResponse> => {
      const response = await api.get<TListResponse>(basePath, { params });
      return response.data;
    },

    get: async (id: string): Promise<TEntity> => {
      const response = await api.get<TEntity>(`${base}/${id}`);
      return response.data;
    },

    create: async (data: TCreateData): Promise<TEntity> => {
      const response = await api.post<TEntity>(basePath, data);
      return response.data;
    },

    update: async (id: string, data: TUpdateData): Promise<TEntity> => {
      const response = await api[method]<TEntity>(`${base}/${id}`, data);
      return response.data;
    },

    delete: async (id: string): Promise<void> => {
      await api.delete(`${base}/${id}`);
    },
  };
}
