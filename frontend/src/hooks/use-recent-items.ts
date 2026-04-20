import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRecentItems,
  recordRecentItem,
  deleteRecentItem,
  clearRecentItems,
  type RecentItemType,
  type RecordRecentItemData,
} from "@/lib/api/recent-items";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";

/**
 * Hook to fetch the current user's recent items
 */
export function useRecentItems(limit: number = 20, itemType?: RecentItemType) {
  return useQuery({
    queryKey: queryKeys.recentItems.list(limit, itemType),
    queryFn: () => getRecentItems(limit, itemType),
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Hook to record a view of an item
 * Use this when visiting detail pages to track the view
 */
export function useRecordRecentItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RecordRecentItemData) => recordRecentItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recentItems.all });
    },
    onError: (error: Error) => {
      // Silently fail - this is not critical functionality
      console.error("Failed to record recent item:", error.message);
    },
  });
}

/**
 * Hook to delete a specific recent item
 */
export function useDeleteRecentItem() {
  return useCrudMutation({
    mutationFn: (itemId: string) => deleteRecentItem(itemId),
    invalidateKeys: [queryKeys.recentItems.all],
    successMessage: "Item removed from recent items",
    errorMessage: "Failed to delete recent item",
  });
}

/**
 * Hook to clear all recent items
 */
export function useClearRecentItems() {
  return useCrudMutation({
    mutationFn: () => clearRecentItems(),
    invalidateKeys: [queryKeys.recentItems.all],
    successMessage: "Recent items cleared",
    errorMessage: "Failed to clear recent items",
  });
}

/**
 * Returns a stable callback that records a view of a fixed item type.
 * Use the typed aliases below for callsites — they exist to lock in the
 * `item_type` literal without the caller having to pass it each time.
 */
function useRecordView(itemType: RecentItemType) {
  const { mutate } = useRecordRecentItem();
  return (itemId: string, title: string, subtitle?: string) => {
    mutate({ item_type: itemType, item_id: itemId, item_title: title, item_subtitle: subtitle });
  };
}

export const useRecordProgramView = () => useRecordView("program");
export const useRecordClientView = () => useRecordView("client");
export const useRecordPartnerView = () => useRecordView("partner");
export const useRecordDocumentView = () => useRecordView("document");

/**
 * Hook to automatically track a view when a component mounts
 * Use this on detail pages to automatically record the view
 *
 * @example
 * ```tsx
 * function ProgramDetailPage({ programId }: { programId: string }) {
 *   const { data: program } = useProgram(programId);
 *   useTrackView({
 *     type: "program",
 *     id: programId,
 *     title: program?.title,
 *     subtitle: program?.client_name,
 *     enabled: !!program,
 *   });
 *   // ...
 * }
 * ```
 */
export function useTrackView(options: {
  type: RecentItemType;
  id: string | undefined;
  title: string | undefined;
  subtitle?: string | null;
  enabled?: boolean;
}) {
  const { mutate } = useRecordRecentItem();
  const { type, id, title, subtitle, enabled = true } = options;

  useEffect(() => {
    if (enabled && id && title) {
      mutate({
        item_type: type,
        item_id: id,
        item_title: title,
        item_subtitle: subtitle,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, id, title, type]);
}
