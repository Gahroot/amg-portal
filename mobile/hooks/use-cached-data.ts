/**
 * useCachedData - Hook for offline-first data fetching
 * Integrates with TanStack Query and DataCache for seamless offline support
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { dataCache, CACHE_TTL } from '@/services/DataCache';
import { useOffline } from './use-offline';

/**
 * Options for cached queries
 */
export interface CachedQueryOptions<TData, TError>
  extends Omit<UseQueryOptions<TData, TError, TData>, 'queryKey' | 'queryFn'> {
  cacheKey: string;
  ttl?: number;
  fetchFn: () => Promise<TData>;
  enableOfflineCache?: boolean;
}

/**
 * Hook for offline-first data fetching
 * Automatically serves cached data when offline
 */
export function useCachedQuery<TData, TError = Error>(
  queryKey: unknown[],
  options: CachedQueryOptions<TData, TError>
) {
  const { cacheKey, ttl = CACHE_TTL.DEFAULT, fetchFn, enableOfflineCache = true } = options;
  const { isOffline } = useOffline();
  const queryClient = useQueryClient();
  const isInitialized = useRef(false);

  // Load cached data on mount
  useEffect(() => {
    if (!enableOfflineCache || isInitialized.current) return;
    isInitialized.current = true;

    const loadCachedData = async () => {
      const cached = await dataCache.getStale<TData>(cacheKey);
      if (cached) {
        // Set cached data immediately
        queryClient.setQueryData(queryKey, cached);
      }
    };

    loadCachedData();
  }, [cacheKey, queryKey, queryClient, enableOfflineCache]);

  const query = useQuery<TData, TError>({
    queryKey,
    queryFn: async () => {
      try {
        const data = await fetchFn();

        // Cache successful responses
        if (enableOfflineCache) {
          await dataCache.set(cacheKey, data, ttl);
        }

        return data;
      } catch (error) {
        // If offline, try to return cached data
        if (isOffline && enableOfflineCache) {
          const cached = await dataCache.getStale<TData>(cacheKey);
          if (cached) {
            return cached;
          }
        }
        throw error;
      }
    },
    // Use longer stale time when offline
    staleTime: isOffline ? Infinity : options.staleTime,
    // Don't retry when offline
    retry: isOffline ? false : (options.retry ?? 3),
    // Don't refetch when offline
    refetchOnWindowFocus: !isOffline,
    ...options,
  });

  return {
    ...query,
    isFromCache: query.isStale && isOffline,
  };
}

/**
 * Options for cached mutations
 */
export interface CachedMutationOptions<TData, TError, TVariables>
  extends Omit<UseMutationOptions<TData, TError, TVariables>, 'mutationFn'> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  queueKey?: string;
  onQueued?: (variables: TVariables) => void;
}

/**
 * Hook for mutations with offline queue support
 */
export function useCachedMutation<TData, TError = Error, TVariables = void>(
  options: CachedMutationOptions<TData, TError, TVariables>
) {
  const { mutationFn, queueKey, onQueued, ...restOptions } = options;
  const { isOffline } = useOffline();

  return useMutation<TData, TError, TVariables>({
    mutationFn: async (variables: TVariables) => {
      if (isOffline && queueKey) {
        // Queue the mutation for later
        const queue = (await dataCache.get<TVariables[]>(queueKey)) || [];
        await dataCache.set(queueKey, [...queue, variables], 24 * 60 * 60 * 1000);
        onQueued?.(variables);

        // Return a placeholder to avoid error
        throw new Error('QUEUED_FOR_SYNC');
      }

      return mutationFn(variables);
    },
    ...restOptions,
  });
}

/**
 * Hook to sync queued data when back online
 */
export function useSyncOnReconnect() {
  const { isOnline, wasOffline, clearOfflineFlag } = useOffline();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isOnline && wasOffline) {
      // Invalidate all queries to refetch fresh data
      queryClient.invalidateQueries();

      // Clear expired cache entries
      dataCache.clearExpired();

      // Clear the was offline flag
      clearOfflineFlag();
    }
  }, [isOnline, wasOffline, queryClient, clearOfflineFlag]);
}

/**
 * Hook to get cached programs list
 */
export function useCachedPrograms(filter?: { status?: string; search?: string }) {
  const cacheKey = `programs_${filter?.status || 'all'}_${filter?.search || ''}`;

  return useCachedQuery(
    ['client-programs', filter?.status, filter?.search],
    {
      cacheKey,
      ttl: CACHE_TTL.PROGRAMS,
      enableOfflineCache: true,
      fetchFn: async () => {
        // Dynamic import to avoid circular dependencies
        const { listPrograms } = await import('@/lib/api/programs');
        return listPrograms({ status: filter?.status, limit: 50 });
      },
    }
  );
}

/**
 * Hook to get cached program details
 */
export function useCachedProgram(id: string) {
  const cacheKey = `program_${id}`;

  return useCachedQuery(
    ['program', id],
    {
      cacheKey,
      ttl: CACHE_TTL.PROGRAM_DETAIL,
      enabled: !!id,
      enableOfflineCache: true,
      fetchFn: async () => {
        const { getProgram } = await import('@/lib/api/programs');
        return getProgram(id);
      },
    }
  );
}

/**
 * Hook to get cached documents
 */
export function useCachedDocuments(params?: { entity_type?: string; entity_id?: string }) {
  const cacheKey = `documents_${params?.entity_type || 'all'}_${params?.entity_id || 'all'}`;

  return useCachedQuery(
    ['documents', params?.entity_type, params?.entity_id],
    {
      cacheKey,
      ttl: CACHE_TTL.DOCUMENTS,
      enableOfflineCache: true,
      fetchFn: async () => {
        const { listDocuments } = await import('@/lib/api/documents');
        return listDocuments(params);
      },
    }
  );
}

/**
 * Hook to get cached client info
 */
export function useCachedClient(clientId: string) {
  const cacheKey = `client_${clientId}`;

  return useCachedQuery(
    ['client', clientId],
    {
      cacheKey,
      ttl: CACHE_TTL.CLIENT_DETAIL,
      enabled: !!clientId,
      enableOfflineCache: true,
      fetchFn: async () => {
        const { getClient } = await import('@/lib/api/clients');
        return getClient(clientId);
      },
    }
  );
}

/**
 * Hook to get cached conversations
 */
export function useCachedConversations(params?: { conversation_type?: string }) {
  const cacheKey = `conversations_${params?.conversation_type || 'all'}`;

  return useCachedQuery(
    ['conversations', params?.conversation_type],
    {
      cacheKey,
      ttl: CACHE_TTL.MESSAGES,
      enableOfflineCache: true,
      fetchFn: async () => {
        const { listConversations } = await import('@/lib/api/conversations');
        return listConversations(params);
      },
    }
  );
}

/**
 * Prefetch and cache data
 */
export function usePrefetchCache() {
  const queryClient = useQueryClient();

  const prefetchPrograms = useCallback(async () => {
    const { listPrograms } = await import('@/lib/api/programs');
    const data = await listPrograms({ limit: 50 });
    await dataCache.set('programs_all', data, CACHE_TTL.PROGRAMS);
    queryClient.setQueryData(['client-programs', undefined, undefined], data);
  }, [queryClient]);

  const prefetchProgramDetails = useCallback(
    async (programIds: string[]) => {
      const { getProgram } = await import('@/lib/api/programs');
      for (const id of programIds) {
        const data = await getProgram(id);
        await dataCache.set(`program_${id}`, data, CACHE_TTL.PROGRAM_DETAIL);
        queryClient.setQueryData(['program', id], data);
      }
    },
    [queryClient]
  );

  return {
    prefetchPrograms,
    prefetchProgramDetails,
  };
}
