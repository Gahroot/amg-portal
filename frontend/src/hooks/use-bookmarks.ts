import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addBookmark,
  getBookmarks,
  removeBookmark,
  type Bookmark,
  type BookmarkCreateData,
  type BookmarkEntityType,
} from "@/lib/api/bookmarks";

const QUERY_KEY = ["bookmarks"];

/**
 * Fetch all bookmarks for the current user.
 */
export function useBookmarks(entityType?: BookmarkEntityType) {
  return useQuery({
    queryKey: [...QUERY_KEY, entityType],
    queryFn: () => getBookmarks(entityType),
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Check if a specific entity is bookmarked.
 * Returns { isBookmarked, bookmark } using data already in cache.
 */
export function useIsBookmarked(
  entityType: BookmarkEntityType,
  entityId: string
) {
  const { data, isLoading } = useBookmarks();
  const bookmark = data?.items.find(
    (b) => b.entity_type === entityType && b.entity_id === entityId
  );
  return { isBookmarked: !!bookmark, bookmark, isLoading };
}

/**
 * Toggle bookmark state for an entity.
 */
export function useToggleBookmark() {
  const queryClient = useQueryClient();

  const addMutation = useMutation({
    mutationFn: (data: BookmarkCreateData) => addBookmark(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Pinned");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to pin item");
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({
      entityType,
      entityId,
    }: {
      entityType: BookmarkEntityType;
      entityId: string;
    }) => removeBookmark(entityType, entityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Unpinned");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to unpin item");
    },
  });

  function toggle(
    isCurrentlyBookmarked: boolean,
    data: BookmarkCreateData
  ) {
    if (isCurrentlyBookmarked) {
      removeMutation.mutate({
        entityType: data.entity_type,
        entityId: data.entity_id,
      });
    } else {
      addMutation.mutate(data);
    }
  }

  return {
    toggle,
    isPending: addMutation.isPending || removeMutation.isPending,
  };
}

export type { Bookmark, BookmarkEntityType };
