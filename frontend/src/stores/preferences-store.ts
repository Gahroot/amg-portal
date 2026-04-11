"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  UIPreferences,
  UIPreferencesUpdate,
  SyncState,
  QueuedChange,
  SyncChange,
  UserPreferencesResponse,
  ConflictResolution,
} from "@/types/preferences";
import { defaultUIPreferences } from "@/types/preferences";

/**
 * Generate a unique device ID
 */
function generateDeviceId(): string {
  const stored = localStorage.getItem("amg-device-id");
  if (stored) return stored;

  const id = `web-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  localStorage.setItem("amg-device-id", id);
  return id;
}

/**
 * Generate a unique ID for queued changes
 */
function generateChangeId(): string {
  return `change-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Preferences store state
 */
interface PreferencesStoreState {
  /** Current UI preferences */
  preferences: UIPreferences;
  /** Sync state tracking */
  syncState: SyncState;
  /** Queued changes for offline sync */
  offlineQueue: QueuedChange[];
  /** Server version for optimistic locking */
  serverVersion: number;
  /** Device ID for this client */
  deviceId: string;
  /** Whether sync is enabled */
  syncEnabled: boolean;
}

/**
 * Preferences store actions
 */
interface PreferencesStoreActions {
  /** Update a single preference key */
  updatePreference: <K extends keyof UIPreferences>(
    key: K,
    value: UIPreferences[K]
  ) => void;
  /** Update multiple preferences at once */
  updatePreferences: (updates: UIPreferencesUpdate) => void;
  /** Set preferences from server response */
  setPreferencesFromServer: (response: UserPreferencesResponse) => void;
  /** Queue a change for offline sync */
  queueChange: (change: SyncChange) => void;
  /** Remove a queued change after successful sync */
  removeQueuedChange: (id: string) => void;
  /** Clear the offline queue */
  clearOfflineQueue: () => void;
  /** Set sync state */
  setSyncState: (state: Partial<SyncState>) => void;
  /** Set conflict information */
  setConflict: (conflict: ConflictResolution | null) => void;
  /** Update server version */
  setServerVersion: (version: number) => void;
  /** Reset store to defaults */
  reset: () => void;
}

type PreferencesStore = PreferencesStoreState & PreferencesStoreActions;

/**
 * Initial sync state
 */
const initialSyncState: SyncState = {
  isSyncing: false,
  lastSyncedAt: null,
  pendingChanges: 0,
  conflictDetected: false,
  conflict: null,
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
};

/**
 * Zustand store for user preferences with multi-device sync support
 */
export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set, get) => ({
      preferences: defaultUIPreferences,
      syncState: initialSyncState,
      offlineQueue: [],
      serverVersion: 1,
      deviceId: typeof window !== "undefined" ? generateDeviceId() : "",
      syncEnabled: true,

      updatePreference: (key, value) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            [key]: value,
          },
        }));
      },

      updatePreferences: (updates) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            ...updates,
          },
        }));
      },

      setPreferencesFromServer: (response) => {
        set({
          preferences: response.ui_preferences as UIPreferences,
          serverVersion: response.version,
          syncEnabled: response.sync_enabled,
          syncState: {
            ...get().syncState,
            lastSyncedAt: new Date(response.updated_at),
          },
        });
      },

      queueChange: (change) => {
        const queuedChange: QueuedChange = {
          id: generateChangeId(),
          change,
          queuedAt: new Date(),
        };
        set((state) => ({
          offlineQueue: [...state.offlineQueue, queuedChange],
          syncState: {
            ...state.syncState,
            pendingChanges: state.offlineQueue.length + 1,
          },
        }));
      },

      removeQueuedChange: (id) => {
        set((state) => ({
          offlineQueue: state.offlineQueue.filter((c) => c.id !== id),
          syncState: {
            ...state.syncState,
            pendingChanges: Math.max(0, state.offlineQueue.length - 1),
          },
        }));
      },

      clearOfflineQueue: () => {
        set({
          offlineQueue: [],
          syncState: {
            ...get().syncState,
            pendingChanges: 0,
          },
        });
      },

      setSyncState: (updates) => {
        set((state) => ({
          syncState: {
            ...state.syncState,
            ...updates,
          },
        }));
      },

      setConflict: (conflict) => {
        set((state) => ({
          syncState: {
            ...state.syncState,
            conflictDetected: conflict !== null,
            conflict,
          },
        }));
      },

      setServerVersion: (version) => {
        set({ serverVersion: version });
      },

      reset: () => {
        set({
          preferences: defaultUIPreferences,
          syncState: initialSyncState,
          offlineQueue: [],
          serverVersion: 1,
          syncEnabled: true,
        });
      },
    }),
    {
      name: "amg-preferences",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        serverVersion: state.serverVersion,
        deviceId: state.deviceId,
        syncEnabled: state.syncEnabled,
        offlineQueue: state.offlineQueue,
      }),
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

/**
 * Get current theme preference
 */
export function useTheme() {
  return usePreferencesStore((state) => state.preferences.theme);
}

/**
 * Get sidebar collapsed state
 */
export function useSidebarCollapsed() {
  return usePreferencesStore((state) => state.preferences.sidebar_collapsed);
}

/**
 * Get density preference
 */
export function useDensity() {
  return usePreferencesStore((state) => state.preferences.density);
}

/**
 * Get sync state
 */
export function useSyncState() {
  return usePreferencesStore((state) => state.syncState);
}

/**
 * Get device ID
 */
export function useDeviceId() {
  return usePreferencesStore((state) => state.deviceId);
}

/**
 * Get pending changes count
 */
export function usePendingChanges() {
  return usePreferencesStore((state) => state.syncState.pendingChanges);
}

