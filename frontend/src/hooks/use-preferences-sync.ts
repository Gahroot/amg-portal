"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import {
  usePreferencesStore,
  useDeviceId,
  useSyncState,
  usePendingChanges,
} from "@/stores/preferences-store";
import {
  getUserPreferences,
  syncPreferences,
  registerDevice,
} from "@/lib/api/preferences";
import type {
  UIPreferencesUpdate,
  SyncChange,
  SyncPushRequest,
  DeviceRegisterRequest,
} from "@/types/preferences";

/**
 * Debounce time for preference sync (in milliseconds)
 */
const SYNC_DEBOUNCE_MS = 1000;

/**
 * Hook for managing preferences sync across devices
 */
export function usePreferencesSync() {
  const queryClient = useQueryClient();
  const deviceId = useDeviceId();
  const syncState = useSyncState();
  const pendingChanges = usePendingChanges();

  const {
    preferences,
    serverVersion,
    offlineQueue,
    updatePreferences,
    setPreferencesFromServer,
    queueChange,
    clearOfflineQueue,
    setSyncState,
    setConflict,
    setServerVersion,
  } = usePreferencesStore();

  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const offlineQueueRef = useRef(offlineQueue);

  useEffect(() => {
    offlineQueueRef.current = offlineQueue;
  }, [offlineQueue]);

  /**
   * Register this device with the server
   */
  const registerCurrentDevice = useCallback(async () => {
    try {
      const request: DeviceRegisterRequest = {
        device_id: deviceId,
        device_type: "web",
        device_name: getBrowserName(),
        user_agent: navigator.userAgent,
        app_version: process.env.NEXT_PUBLIC_APP_VERSION,
      };
      await registerDevice(request);
    } catch (error) {
      console.error("Failed to register device:", error);
    }
  }, [deviceId]);

  /**
   * Pull preferences from server
   */
  const pullFromServer = useCallback(async () => {
    try {
      setSyncState({ isSyncing: true });
      const response = await getUserPreferences();
      setPreferencesFromServer(response);
      setSyncState({
        isSyncing: false,
        lastSyncedAt: new Date(),
        isOnline: true,
      });
      retryCountRef.current = 0;
      return response;
    } catch (error) {
      setSyncState({
        isSyncing: false,
        isOnline: false,
      });
      throw error;
    }
  }, [setSyncState, setPreferencesFromServer]);

  /**
   * Push changes to server
   */
  const pushToServer = useCallback(async () => {
    if (offlineQueue.length === 0) return;

    try {
      setSyncState({ isSyncing: true });

      const request: SyncPushRequest = {
        device_id: deviceId,
        changes: offlineQueue.map((q) => q.change),
        client_version: serverVersion,
      };

      const response = await syncPreferences(request);

      // Update preferences from server response
      setPreferencesFromServer(response.preferences);
      setServerVersion(response.server_version);

      // Clear successfully synced changes
      clearOfflineQueue();

      setSyncState({
        isSyncing: false,
        lastSyncedAt: new Date(response.synced_at),
        isOnline: true,
        pendingChanges: 0,
      });

      retryCountRef.current = 0;

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.preferences() });

      return response;
    } catch (error) {
      setSyncState({
        isSyncing: false,
        isOnline: false,
      });
      throw error;
    }
  }, [
    offlineQueue,
    deviceId,
    serverVersion,
    setSyncState,
    setPreferencesFromServer,
    setServerVersion,
    clearOfflineQueue,
    queryClient,
  ]);

  /**
   * Sync now - push pending changes and pull latest
   */
  const syncNow = useCallback(async () => {
    try {
      if (offlineQueue.length > 0) {
        await pushToServer();
      } else {
        await pullFromServer();
      }
    } catch (error) {
      console.error("Sync failed:", error);
      toast.error("Failed to sync preferences");
    }
  }, [offlineQueue.length, pushToServer, pullFromServer]);

  /**
   * Update a preference and queue for sync
   */
  const updatePreference = useCallback(
    <K extends keyof typeof preferences>(
      key: K,
      value: (typeof preferences)[K],
      immediate = false
    ) => {
      // Update local state immediately
      updatePreferences({ [key]: value });

      // Queue change for sync
      const change: SyncChange = {
        entity_type: "preference",
        action: "update_ui_preference",
        payload: { [key]: value },
        client_timestamp: new Date().toISOString(),
        device_id: deviceId,
      };

      queueChange(change);

      // Debounced sync
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      if (immediate) {
        syncNow().catch((err) => {
          console.error("Immediate sync failed:", err);
        });
      } else {
        syncTimeoutRef.current = setTimeout(() => {
          syncNow().catch((err) => {
            console.error("Debounced sync failed:", err);
          });
        }, SYNC_DEBOUNCE_MS);
      }
    },
    [updatePreferences, queueChange, deviceId, syncNow]
  );

  /**
   * Update multiple preferences at once
   */
  const updateMultiplePreferences = useCallback(
    (updates: UIPreferencesUpdate, immediate = false) => {
      // Update local state immediately
      updatePreferences(updates);

      // Queue change for sync
      const change: SyncChange = {
        entity_type: "preference",
        action: "update_ui_preference",
        payload: updates,
        client_timestamp: new Date().toISOString(),
        device_id: deviceId,
      };

      queueChange(change);

      // Debounced sync
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      if (immediate) {
        syncNow().catch((err) => {
          console.error("Immediate sync failed:", err);
        });
      } else {
        syncTimeoutRef.current = setTimeout(() => {
          syncNow().catch((err) => {
            console.error("Debounced sync failed:", err);
          });
        }, SYNC_DEBOUNCE_MS);
      }
    },
    [updatePreferences, queueChange, deviceId, syncNow]
  );

  /**
   * Resolve a conflict by accepting server version
   */
  const acceptServerVersion = useCallback(async () => {
    try {
      const response = await getUserPreferences();
      setPreferencesFromServer(response);
      setConflict(null);
      clearOfflineQueue();
      toast.success("Preferences updated from server");
    } catch {
      toast.error("Failed to fetch server preferences");
    }
  }, [setPreferencesFromServer, setConflict, clearOfflineQueue]);

  /**
   * Resolve a conflict by forcing local version
   */
  const forceLocalVersion = useCallback(async () => {
    if (syncState.conflict === null) return;

    try {
      // Get the current local preferences and push with client version
      const change: SyncChange = {
        entity_type: "preference",
        action: "update_ui_preference",
        payload: preferences,
        client_timestamp: new Date().toISOString(),
        device_id: deviceId,
      };

      const request: SyncPushRequest = {
        device_id: deviceId,
        changes: [change],
        client_version: syncState.conflict.server_version,
      };

      const response = await syncPreferences(request);
      setPreferencesFromServer(response.preferences);
      setConflict(null);
      clearOfflineQueue();
      toast.success("Local preferences synced");
    } catch {
      toast.error("Failed to sync local preferences");
    }
  }, [
    syncState.conflict,
    preferences,
    deviceId,
    setPreferencesFromServer,
    setConflict,
    clearOfflineQueue,
  ]);

  /**
   * Handle online/offline events
   */
  useEffect(() => {
    const handleOnline = () => {
      setSyncState({ isOnline: true });
      // Auto-sync when coming back online — read current queue from ref so
      // this handler is never torn down/re-registered on every queue change.
      if (offlineQueueRef.current.length > 0) {
        syncNow().catch((err) => {
          console.error("Online re-sync failed:", err);
        });
      }
    };

    const handleOffline = () => {
      setSyncState({ isOnline: false });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setSyncState, syncNow]);

  /**
   * Initial sync on mount
   */
  useEffect(() => {
    const initSync = async () => {
      await registerCurrentDevice();
      await pullFromServer();
    };

    initSync().catch((err) => {
      console.error("Init sync failed:", err);
    });

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [registerCurrentDevice, pullFromServer]);

  /**
   * Periodic sync when online
   */
  useEffect(() => {
    if (!syncState.isOnline) return;

    const interval = setInterval(
      () => {
        if (offlineQueue.length > 0) {
          syncNow().catch((err) => {
            console.error("Periodic sync failed:", err);
          });
        }
      },
      5 * 60 * 1000
    ); // Every 5 minutes

    return () => clearInterval(interval);
  }, [syncState.isOnline, offlineQueue.length, syncNow]);

  return {
    preferences,
    syncState,
    pendingChanges,
    updatePreference,
    updateMultiplePreferences,
    syncNow,
    acceptServerVersion,
    forceLocalVersion,
    isOnline: syncState.isOnline,
    isSyncing: syncState.isSyncing,
    lastSyncedAt: syncState.lastSyncedAt,
    conflict: syncState.conflict,
  };
}

/**
 * Get browser name for device registration
 */
function getBrowserName(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
  return "Unknown Browser";
}

export default usePreferencesSync;
