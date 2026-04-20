/**
 * Generic CRUD factory. Pass the list response type explicitly (L) because
 * each resource returns a differently-keyed envelope (e.g. `{ profiles, total }`
 * vs `{ escalations, total }`) rather than a uniform `{ items, total }`.
 * The factory's `update` uses PATCH; resources that require PUT must call
 * api.put directly.
 */

import api from '@/lib/api';

export interface ListParams {
  skip?: number;
  limit?: number;
  [key: string]: unknown;
}

export function createCRUDClient<
  T,
  L,
  C = Partial<T>,
  U = Partial<T>,
>(resource: string) {
  return {
    list: (params?: ListParams): Promise<L> =>
      api.get<L>(`/${resource}`, { params }).then((r) => r.data),

    get: (id: string): Promise<T> =>
      api.get<T>(`/${resource}/${id}`).then((r) => r.data),

    create: (data: C): Promise<T> =>
      api.post<T>(`/${resource}`, data).then((r) => r.data),

    update: (id: string, data: U): Promise<T> =>
      api.patch<T>(`/${resource}/${id}`, data).then((r) => r.data),

    delete: (id: string): Promise<void> =>
      api.delete(`/${resource}/${id}`).then(() => {}),
  };
}
