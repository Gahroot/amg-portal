import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import type { NotificationPreference } from '@/types/notification';

interface NotificationState {
  unreadCount: number;
  pushToken: string | null;
  preferences: NotificationPreference | null;
  isWebSocketConnected: boolean;
  isHydrated: boolean;
  setUnreadCount: (count: number) => void;
  setPushToken: (token: string | null) => Promise<void>;
  setPreferences: (prefs: NotificationPreference | null) => void;
  setWebSocketConnected: (connected: boolean) => void;
  incrementUnread: () => void;
  decrementUnread: () => void;
  hydrate: () => Promise<void>;
}

const PUSH_TOKEN_KEY = 'amg_push_token';

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  pushToken: null,
  preferences: null,
  isWebSocketConnected: false,
  isHydrated: false,

  setUnreadCount: (count: number) => {
    set({ unreadCount: count });
  },

  setPushToken: async (token: string | null) => {
    if (token) {
      await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
    }
    set({ pushToken: token });
  },

  setPreferences: (prefs: NotificationPreference | null) => {
    set({ preferences: prefs });
  },

  setWebSocketConnected: (connected: boolean) => {
    set({ isWebSocketConnected: connected });
  },

  incrementUnread: () => {
    set({ unreadCount: get().unreadCount + 1 });
  },

  decrementUnread: () => {
    set({ unreadCount: Math.max(0, get().unreadCount - 1) });
  },

  hydrate: async () => {
    try {
      const storedPushToken = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
      set({ pushToken: storedPushToken, isHydrated: true });
    } catch {
      set({ pushToken: null, isHydrated: true });
    }
  },
}));
