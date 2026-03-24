import api from "@/lib/api";

export type BookmarkEntityType = "program" | "client" | "partner";

export interface Bookmark {
  id: string;
  user_id: string;
  entity_type: BookmarkEntityType;
  entity_id: string;
  entity_title: string;
  entity_subtitle: string | null;
  display_order: number;
  created_at: string;
  url: string;
}

export interface BookmarkListResponse {
  items: Bookmark[];
  total: number;
}

export interface BookmarkCreateData {
  entity_type: BookmarkEntityType;
  entity_id: string;
  entity_title: string;
  entity_subtitle?: string | null;
}

/**
 * Get all bookmarks for the current user.
 */
export async function getBookmarks(
  entityType?: BookmarkEntityType
): Promise<BookmarkListResponse> {
  const params: Record<string, string> = {};
  if (entityType) {
    params.entity_type = entityType;
  }
  const response = await api.get<BookmarkListResponse>(
    "/api/v1/auth/me/bookmarks",
    { params }
  );
  return response.data;
}

/**
 * Add a bookmark. Returns the existing bookmark if already bookmarked.
 */
export async function addBookmark(data: BookmarkCreateData): Promise<Bookmark> {
  const response = await api.post<Bookmark>("/api/v1/auth/me/bookmarks", data);
  return response.data;
}

/**
 * Remove a bookmark by entity type and entity ID.
 */
export async function removeBookmark(
  entityType: BookmarkEntityType,
  entityId: string
): Promise<void> {
  await api.delete(
    `/api/v1/auth/me/bookmarks/${entityType}/${entityId}`
  );
}
