import { useCallback, useEffect } from 'react';

import { useAuthStore } from '@/lib/auth-store';
import { useNotificationStore } from '@/lib/notification-store';
import { usePushNotifications } from './use-push-notifications';
import api from '@/lib/api';
import type { NotificationListResponse } from '@/types/notification';

export function useNotifications() {
  const token = useAuthStore((s) => s.token);
  const { pushToken, requestPermissions, setBadgeCount } = usePushNotifications();
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const incrementUnread = useNotificationStore((s) => s.incrementUnread);
  const decrementUnread = useNotificationStore((s) => s.decrementUnread);
  const setPreferences = useNotificationStore((s) => s.setPreferences);
  const preferences = useNotificationStore((s) => s.preferences);

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const response = await api.get<NotificationListResponse>('/notifications', {
        params: { unread_only: true, limit: 0 },
      });
      const count = response.data.total;
      setUnreadCount(count);
      setBadgeCount(count);
    } catch {
      // ignore
    }
  }, [token, setUnreadCount, setBadgeCount]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!token) return false;
      try {
        await api.patch(`/notifications/${notificationId}/read`);
        decrementUnread();
        const newCount = Math.max(0, useNotificationStore.getState().unreadCount - 1);
        setBadgeCount(newCount);
        return true;
      } catch {
        return false;
      }
    },
    [token, decrementUnread, setBadgeCount],
  );

  const markAllAsRead = useCallback(async () => {
    if (!token) return false;
    try {
      await api.post('/notifications/mark-all-read');
      setUnreadCount(0);
      setBadgeCount(0);
      return true;
    } catch {
      return false;
    }
  }, [token, setUnreadCount, setBadgeCount]);

  const updatePreferences = useCallback(
    async (prefs: Record<string, unknown>) => {
      if (!token) return false;
      try {
        const response = await api.patch('/notifications/preferences', prefs);
        setPreferences(response.data);
        return true;
      } catch {
        return false;
      }
    },
    [token, setPreferences],
  );

  useEffect(() => {
    if (token) {
      fetchUnreadCount();
      requestPermissions();
    }
  }, [token, fetchUnreadCount, requestPermissions]);

  return {
    pushToken,
    preferences,
    markAsRead,
    markAllAsRead,
    updatePreferences,
    fetchUnreadCount,
    incrementUnread,
  };
}
