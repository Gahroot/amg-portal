import api from "@/lib/api";

export type RecentItemType = "program" | "client" | "partner" | "document" | "task";

export interface RecentItem {
  id: string;
  user_id: string;
  item_type: RecentItemType;
  item_id: string;
  item_title: string;
  item_subtitle: string | null;
  viewed_at: string;
  url: string;
}

export interface RecentItemListResponse {
  items: RecentItem[];
  total: number;
}

export interface RecordRecentItemData {
  item_type: RecentItemType;
  item_id: string;
  item_title: string;
  item_subtitle?: string | null;
}

/**
 * Get the current user's recent items
 */
export async function getRecentItems(
  limit: number = 20,
  itemType?: RecentItemType
): Promise<RecentItemListResponse> {
  const params: Record<string, string | number> = { limit };
  if (itemType) {
    params.item_type = itemType;
  }
  const response = await api.get<RecentItemListResponse>(
    "/api/v1/auth/me/recent-items",
    { params }
  );
  return response.data;
}

/**
 * Record a view of an item
 */
export async function recordRecentItem(
  data: RecordRecentItemData
): Promise<RecentItem> {
  const response = await api.post<RecentItem>(
    "/api/v1/auth/me/recent-items",
    data
  );
  return response.data;
}

/**
 * Delete a specific recent item
 */
export async function deleteRecentItem(itemId: string): Promise<void> {
  await api.delete(`/api/v1/auth/me/recent-items/${itemId}`);
}

/**
 * Clear all recent items for the current user
 */
export async function clearRecentItems(): Promise<void> {
  await api.delete("/api/v1/auth/me/recent-items");
}
