"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { updateReadStatus, batchUpdateReadStatus, getReadStatus } from "@/lib/api/preferences";
import { useDeviceId } from "@/stores/preferences-store";
import type { ReadStatusResponse, ReadStatusUpdateRequest, EntityType } from "@/types/preferences";

import { queryKeys } from "@/lib/query-keys";

/**
 * Query key factory for read status — delegates to centralized queryKeys
 */
const readStatusKeys = queryKeys.readStatus;

/**
 * Hook for managing read status of a single entity
 */
export function useReadStatus(entityType: EntityType, entityId: string) {
  const queryClient = useQueryClient();
  const deviceId = useDeviceId();
  const [optimisticIsRead, setOptimisticIsRead] = useState<boolean | null>(null);

  // Fetch read status
  const { data, isLoading, error } = useQuery({
    queryKey: readStatusKeys.entity(entityType, entityId),
    queryFn: () => getReadStatus(entityType, entityId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (isRead: boolean) => {
      const update: ReadStatusUpdateRequest = {
        entity_type: entityType,
        entity_id: entityId,
        is_read: isRead,
        device_id: deviceId,
      };
      return updateReadStatus(update);
    },
    onMutate: async (isRead) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: readStatusKeys.entity(entityType, entityId),
      });

      // Optimistically update
      setOptimisticIsRead(isRead);

      // Return context for rollback
      return { previousIsRead: data?.is_read };
    },
    onError: (_err, _isRead, context) => {
      // Rollback on error
      setOptimisticIsRead(context?.previousIsRead ?? null);
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({
        queryKey: readStatusKeys.entity(entityType, entityId),
      });
      setOptimisticIsRead(null);
    },
  });

  // Computed is_read value
  const isRead = optimisticIsRead !== null ? optimisticIsRead : data?.is_read ?? false;

  /**
   * Mark entity as read
   */
  const markAsRead = useCallback(() => {
    if (!isRead) {
      updateMutation.mutate(true);
    }
  }, [isRead, updateMutation]);

  /**
   * Mark entity as unread
   */
  const markAsUnread = useCallback(() => {
    if (isRead) {
      updateMutation.mutate(false);
    }
  }, [isRead, updateMutation]);

  /**
   * Toggle read status
   */
  const toggleRead = useCallback(() => {
    updateMutation.mutate(!isRead);
  }, [isRead, updateMutation]);

  return {
    isRead,
    readAt: data?.read_at ?? null,
    isLoading,
    isUpdating: updateMutation.isPending,
    error,
    markAsRead,
    markAsUnread,
    toggleRead,
  };
}

/**
 * Hook for managing read status of multiple entities
 */
export function useBatchReadStatus() {
  const queryClient = useQueryClient();
  const deviceId = useDeviceId();

  // Batch update mutation
  const batchMutation = useMutation({
    mutationFn: (updates: ReadStatusUpdateRequest[]) => {
      // Add device_id to each update
      const updatesWithDevice = updates.map((u) => ({
        ...u,
        device_id: u.device_id ?? deviceId,
      }));
      return batchUpdateReadStatus(updatesWithDevice);
    },
    onSuccess: (_data, variables) => {
      // Invalidate all affected entity queries
      variables.forEach((update) => {
        queryClient.invalidateQueries({
          queryKey: readStatusKeys.entity(update.entity_type, update.entity_id),
        });
      });
    },
  });

  /**
   * Mark multiple entities as read
   */
  const markAllAsRead = useCallback(
    (entities: Array<{ entityType: EntityType; entityId: string }>) => {
      const updates: ReadStatusUpdateRequest[] = entities.map((e) => ({
        entity_type: e.entityType,
        entity_id: e.entityId,
        is_read: true,
        device_id: deviceId,
      }));
      return batchMutation.mutateAsync(updates);
    },
    [deviceId, batchMutation]
  );

  /**
   * Mark multiple entities as unread
   */
  const markAllAsUnread = useCallback(
    (entities: Array<{ entityType: EntityType; entityId: string }>) => {
      const updates: ReadStatusUpdateRequest[] = entities.map((e) => ({
        entity_type: e.entityType,
        entity_id: e.entityId,
        is_read: false,
        device_id: deviceId,
      }));
      return batchMutation.mutateAsync(updates);
    },
    [deviceId, batchMutation]
  );

  return {
    markAllAsRead,
    markAllAsUnread,
    isUpdating: batchMutation.isPending,
    error: batchMutation.error,
  };
}

/**
 * Hook for tracking read status of a list of entities
 * Useful for displaying unread counts in lists
 */
export function useReadStatusTracker<T extends { id: string }>(
  entityType: EntityType,
  items: T[]
) {
  const [readStatuses, setReadStatuses] = useState<Record<string, boolean>>({});
  const deviceId = useDeviceId();
  const queryClient = useQueryClient();

  // Stable, serialisable representation of item IDs — only changes when the
  // actual set of IDs changes, not when the caller passes a new array reference
  // on every render.  Both useQuery and useEffect depend on this instead of
  // `items` directly to avoid infinite re-render loops.
  const itemIds = useMemo(() => items.map((i) => i.id), [items]);

  // Fetch all read statuses individually
  // Note: For large lists, consider a bulk endpoint
  const { isLoading } = useQuery({
    queryKey: readStatusKeys.tracker(entityType, itemIds),
    queryFn: async () => {
      const results: Record<string, boolean> = {};
      await Promise.all(
        itemIds.map(async (id) => {
          try {
            const status = await getReadStatus(entityType, id);
            results[id] = status.is_read;
          } catch {
            // If not found, assume unread
            results[id] = false;
          }
        })
      );
      return results;
    },
    enabled: itemIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Update local state when query data changes
  useEffect(() => {
    const fetchStatuses = async () => {
      const results: Record<string, boolean> = {};
      await Promise.all(
        itemIds.map(async (id) => {
          try {
            const cached = queryClient.getQueryData<ReadStatusResponse>(
              readStatusKeys.entity(entityType, id)
            );
            if (cached) {
              results[id] = cached.is_read;
            }
          } catch {
            // Ignore cache errors
          }
        })
      );
      if (Object.keys(results).length > 0) {
        setReadStatuses(results);
      }
    };
    fetchStatuses();
  }, [entityType, itemIds, queryClient]);

  /**
   * Mark a single item as read
   */
  const markItemRead = useCallback(
    async (itemId: string) => {
      setReadStatuses((prev) => ({ ...prev, [itemId]: true }));
      try {
        await updateReadStatus({
          entity_type: entityType,
          entity_id: itemId,
          is_read: true,
          device_id: deviceId,
        });
        queryClient.invalidateQueries({
          queryKey: readStatusKeys.entity(entityType, itemId),
        });
      } catch (error) {
        // Revert on error
        setReadStatuses((prev) => ({ ...prev, [itemId]: false }));
        throw error;
      }
    },
    [entityType, deviceId, queryClient]
  );

  /**
   * Mark all items as read
   */
  const markAllRead = useCallback(async () => {
    const unreadIds = items
      .filter((item) => !readStatuses[item.id])
      .map((item) => item.id);

    if (unreadIds.length === 0) return;

    // Optimistic update
    const newStatuses: Record<string, boolean> = {};
    unreadIds.forEach((id) => {
      newStatuses[id] = true;
    });
    setReadStatuses((prev) => ({ ...prev, ...newStatuses }));

    try {
      const updates: ReadStatusUpdateRequest[] = unreadIds.map((id) => ({
        entity_type: entityType,
        entity_id: id,
        is_read: true,
        device_id: deviceId,
      }));
      await batchUpdateReadStatus(updates);

      // Invalidate all affected queries
      unreadIds.forEach((id) => {
        queryClient.invalidateQueries({
          queryKey: readStatusKeys.entity(entityType, id),
        });
      });
    } catch (error) {
      // Revert on error
      const revertedStatuses: Record<string, boolean> = {};
      unreadIds.forEach((id) => {
        revertedStatuses[id] = false;
      });
      setReadStatuses((prev) => ({ ...prev, ...revertedStatuses }));
      throw error;
    }
  }, [items, readStatuses, entityType, deviceId, queryClient]);

  // Count unread items
  const unreadCount = items.filter((item) => !readStatuses[item.id]).length;

  return {
    readStatuses,
    isLoading,
    unreadCount,
    markItemRead,
    markAllRead,
  };
}

export default useReadStatus;
