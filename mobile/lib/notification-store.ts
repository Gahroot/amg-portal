import { create } from 'zustand';
import type { NotificationPreference } from '@/types/notification';

interface NotificationState {
  unreadCount: number;
  isWebSocketConnected: boolean;
  preferences: NotificationPreference | null;
  pushToken: string | null;

  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  decrementUnread: () => void;
  setWebSocketConnected: (connected: boolean) => void;
  setPreferences: (prefs: NotificationPreference | null) => void;
  setPushToken: (token: string | null) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  isWebSocketConnected: false,
  preferences: null,
  pushToken: null,

  setUnreadCount: (count) => set({ unreadCount: count }),
  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  decrementUnread: () => set((s) => ({ unreadCount: Math.max(0, s.unreadCount - 1) })),
  setWebSocketConnected: (connected) => set({ isWebSocketConnected: connected }),
  setPreferences: (prefs) => set({ preferences: prefs }),
  setPushToken: (token) => set({ pushToken: token }),
}));
