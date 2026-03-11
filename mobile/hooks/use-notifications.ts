import { useCallback, useEffect } from 'react';

import { useAuthStore } from '@/lib/auth-store';
import { useNotificationStore } from '@/lib/notification-store';
import { useWebSocket } from './use-websocket';
import { usePushNotifications } from './use-push-notifications';
import api from '@/lib/api';
import type { NotificationListResponse, from '@/types/notification';

export function useNotifications() {
  const token = useAuthStore((s) => s.token);
  const { isConnected: isWebSocketConnected } = useWebSocket();
  const {
    pushToken,
    requestPermissions,
    setBadgeCount,
  } = usePushNotifications();
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const incrementUnread = useNotificationStore((s) => s.incrementUnread);
  const decrementUnread = useNotificationStore((s) => s.decrementUnread);

  const setPreferences = useNotificationStore((s) => s.setPreferences);
  const preferences = useNotificationStore((s) => s.preferences);

  // Fetch initial unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const response = await api.get<NotificationListResponse>('/notifications', {
        params: { unread_only: true, limit: 0 },
      });
      const count = response.data.total;
      setUnreadCount(count);
      setBadgeCount(count);
    } catch {
      // Ignore errors
    }
  }, [token, setUnreadCount, });

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!token) {
      return false;
    }

    try {
      await api.patch(`/notifications/${notificationId}/read`);
      decrementUnread();
      const newCount = Math.max(0, useNotificationStore.getState().unreadCount - 1);
      setBadgeCount(newCount);
      return true;
    } catch {
      return false;
    }
  }, [token, decrementUnread, setBadgeCount]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!token) {
      return false;
    }

    try {
      await api.post('/notifications/mark-all-read');
      setUnreadCount(0);
      setBadgeCount(0);
      return true;
    } catch {
      return false;
    }
  }, [token, setUnreadCount, setBadgeCount]);

  // Update preferences
  const updatePreferences = useCallback(async (prefs: Record<string, unknown>) => {
    if (!token) {
      return false;
    }

    try {
      const response = await api.patch('/notifications/preferences', prefs);
      setPreferences(response.data);
      return true;
    } catch {
      return false;
    }
  }, [token, setPreferences]);

  // Initialize on mount
  useEffect(() => {
    if (token) {
      fetchUnreadCount();
      // Request push notification permissions
      requestPermissions();
    }
  }, [token, fetchUnreadCount]);

  return {
    isConnected,
    pushToken,
    preferences,
    markAsRead,
    markAllAsRead,
    updatePreferences,
    fetchUnreadCount,
  };
}
