/**
 * useOffline - Hook for offline detection and management
 * Integrates with TanStack Query's online manager
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

import { dataCache } from '@/services/DataCache';
import { refreshToken as refreshTokenApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/auth-store';
import { parseJwtExp } from '@/lib/utils';

const TOKEN_EXPIRY_SKEW_MS = 30 * 1000;

async function ensureFreshToken(): Promise<boolean> {
  const store = useAuthStore.getState();
  const exp = parseJwtExp(store.token);
  if (exp && exp - Date.now() > TOKEN_EXPIRY_SKEW_MS) {
    return true;
  }
  if (!store.refreshToken) {
    return false;
  }
  try {
    const res = await refreshTokenApi(store.refreshToken);
    await store.setTokens(res.access_token, res.refresh_token);
    return true;
  } catch {
    return false;
  }
}

// onlineManager is owned by query-client.ts via setEventListener — do not call
// setOnline() here or you will create competing writers with no cleanup.

export interface OfflineState {
  isOnline: boolean;
  isOffline: boolean;
  isConnected: boolean | null; // Physical connection
  isInternetReachable: boolean | null; // Actual internet access
  connectionType: string;
  lastOnlineTime: number | null;
  wasOffline: boolean; // True if we were offline at some point
}

export interface OfflineActions {
  checkConnection: () => Promise<boolean>;
  clearOfflineFlag: () => void;
}

const OFFLINE_TIMESTAMP_KEY = 'last_offline_timestamp';

/**
 * Hook to manage offline state and sync with TanStack Query
 */
export function useOffline(): OfflineState & OfflineActions {
  const [state, setState] = useState<OfflineState>({
    isOnline: true,
    isOffline: false,
    isConnected: null,
    isInternetReachable: null,
    connectionType: 'unknown',
    lastOnlineTime: Date.now(),
    wasOffline: false,
  });

  const previousState = useRef<boolean | null>(null);


  /**
   * Handle network state changes
   */
  const handleNetworkChange = useCallback(
    async (netInfoState: NetInfoState) => {
      const isConnected = netInfoState.isConnected;
      const isInternetReachable = netInfoState.isInternetReachable;

      // Consider online only if connected AND internet is reachable
      // Handle null case (initial state) - assume online
      const isOnline =
        isConnected === true && (isInternetReachable === true || isInternetReachable === null);

      const isOffline = isConnected === false || isInternetReachable === false;

      // Track if we were offline (for showing "back online" messages)
      const wasOffline = previousState.current === false && isOnline;

      // Store last online time
      if (isOnline && previousState.current === false) {
        await dataCache.set(OFFLINE_TIMESTAMP_KEY, Date.now());
      }

      setState((prev) => ({
        ...prev,
        isOnline,
        isOffline,
        isConnected,
        isInternetReachable,
        connectionType: netInfoState.type,
        lastOnlineTime: isOnline ? Date.now() : prev.lastOnlineTime,
        wasOffline: wasOffline || prev.wasOffline,
      }));

      previousState.current = isOnline;
    },
    []
  );

  /**
   * Manually check connection
   */
  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const netInfoState = await NetInfo.fetch();
      await handleNetworkChange(netInfoState);
      const isOnline =
        netInfoState.isConnected === true &&
        (netInfoState.isInternetReachable === true || netInfoState.isInternetReachable === null);
      return isOnline;
    } catch (error) {
      console.error('Failed to check connection:', error);
      return false;
    }
  }, [handleNetworkChange]);

  /**
   * Clear the wasOffline flag (after showing "back online" message)
   */
  const clearOfflineFlag = useCallback(() => {
    setState((prev) => ({ ...prev, wasOffline: false }));
  }, []);

  /**
   * Setup network listener
   */
  useEffect(() => {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);

    // Fetch initial state
    NetInfo.fetch().then(handleNetworkChange);

    return () => {
      unsubscribe();
    };
  }, [handleNetworkChange]);

  /**
   * Handle app state changes (background/foreground)
   */
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Check connection when app comes to foreground
        await checkConnection();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [checkConnection]);

  return {
    ...state,
    checkConnection,
    clearOfflineFlag,
  };
}

/**
 * Hook to check if a specific action can be performed offline
 */
export function useCanPerformOffline(actionType: 'read' | 'write' | 'sync'): boolean {
  const { isOffline, isOnline } = useOffline();

  switch (actionType) {
    case 'read':
      return true; // Can always read cached data
    case 'write':
    case 'sync':
      return isOnline; // Need network for writes and sync
    default:
      return !isOffline;
  }
}

/**
 * Hook for actions that should be queued when offline
 */
export function useOfflineQueue<T>(queueKey: string) {
  const { isOnline } = useOffline();
  const queueRef = useRef<T[]>([]);

  const addToQueue = useCallback(
    async (item: T) => {
      if (isOnline) {
        return false; // Don't queue, process immediately
      }

      queueRef.current.push(item);

      // Persist queue
      const existingQueue = (await dataCache.get<T[]>(queueKey)) || [];
      await dataCache.set(queueKey, [...existingQueue, item], 24 * 60 * 60 * 1000); // 24 hours

      return true; // Queued
    },
    [isOnline, queueKey]
  );

  const getQueue = useCallback(async (): Promise<T[]> => {
    const queue = await dataCache.get<T[]>(queueKey);
    return queue || [];
  }, [queueKey]);

  const clearQueue = useCallback(async () => {
    await dataCache.remove(queueKey);
    queueRef.current = [];
  }, [queueKey]);

  const processQueue = useCallback(
    async (processor: (item: T) => Promise<boolean>): Promise<{ processed: number; failed: number }> => {
      const queue = await getQueue();
      let processed = 0;
      let failed = 0;

      for (const item of queue) {
        if (!(await ensureFreshToken())) {
          await SecureStore.setItemAsync('amg_needs_reauth', 'true');
          await useAuthStore.getState().clearAuth();
          router.replace('/(auth)/login');
          return { processed, failed: queue.length - processed };
        }
        try {
          const success = await processor(item);
          if (success) {
            processed++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      // Clear processed items
      if (processed > 0) {
        await clearQueue();
      }

      return { processed, failed };
    },
    [getQueue, clearQueue]
  );

  return {
    addToQueue,
    getQueue,
    clearQueue,
    processQueue,
  };
}
