import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getRecentItems,
  recordRecentItem,
  deleteRecentItem,
  clearRecentItems,
  type RecentItemType,
  type RecordRecentItemData,
} from "@/lib/api/recent-items";

/**
 * Hook to fetch the current user's recent items
 */
export function useRecentItems(limit: number = 20, itemType?: RecentItemType) {
  return useQuery({
    queryKey: ["recent-items", limit, itemType],
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
      // Invalidate recent items to refresh the list
      queryClient.invalidateQueries({ queryKey: ["recent-items"] });
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => deleteRecentItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recent-items"] });
      toast.success("Item removed from recent items");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete recent item");
    },
  });
}

/**
 * Hook to clear all recent items
 */
export function useClearRecentItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => clearRecentItems(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recent-items"] });
      toast.success("Recent items cleared");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to clear recent items");
    },
  });
}

/**
 * Convenience function to record a program view
 */
export function useRecordProgramView() {
  const { mutate } = useRecordRecentItem();
  return (programId: string, title: string, subtitle?: string) => {
    mutate({
      item_type: "program",
      item_id: programId,
      item_title: title,
      item_subtitle: subtitle,
    });
  };
}

/**
 * Convenience function to record a client view
 */
export function useRecordClientView() {
  const { mutate } = useRecordRecentItem();
  return (clientId: string, title: string, subtitle?: string) => {
    mutate({
      item_type: "client",
      item_id: clientId,
      item_title: title,
      item_subtitle: subtitle,
    });
  };
}

/**
 * Convenience function to record a partner view
 */
export function useRecordPartnerView() {
  const { mutate } = useRecordRecentItem();
  return (partnerId: string, title: string, subtitle?: string) => {
    mutate({
      item_type: "partner",
      item_id: partnerId,
      item_title: title,
      item_subtitle: subtitle,
    });
  };
}

/**
 * Convenience function to record a document view
 */
export function useRecordDocumentView() {
  const { mutate } = useRecordRecentItem();
  return (documentId: string, title: string, subtitle?: string) => {
    mutate({
      item_type: "document",
      item_id: documentId,
      item_title: title,
      item_subtitle: subtitle,
    });
  };
}

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
