import { useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useNotificationStore } from '@/lib/notification-store';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const [pushToken, setLocalPushToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Notifications.PermissionStatus | null>(null);
  const token = useAuthStore((s) => s.token);
  const setStorePushToken = useNotificationStore((s) => s.setPushToken);

  // Request permissions
  const requestPermissions = useCallback(async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setPermissionStatus(status);
    return status === Notifications.PermissionStatus.GRANTED;
  }, []);

  // Get push token
  const getPushToken = useCallback(async () => {
    if (permissionStatus !== Notifications.PermissionStatus.GRANTED) {
      return null;
    }

    try {
      const token = await Notifications.getExpoPushTokenAsync();
      if (token) {
        setLocalPushToken(token);
        return token;
      }
    } catch {
    return null;
    }
    return null;
  }, [permissionStatus]);

  // Register token with backend
  const registerToken = useCallback(async (tokenString: string) => {
    if (!token) {
      return false;
    }

    try {
      await api.post('/push-tokens', {
        token: tokenString,
        platform: 'mobile', // Could detect iOS/Android
      });
      await setStorePushToken(tokenString);
      return true;
    } catch {
      return false;
    }
  }, [token, setStorePushToken]);

  // Unregister token
  const unregisterToken = useCallback(async (tokenString: string) => {
    if (!token) {
      return false;
    }

    try {
      await api.delete(`/push-tokens/${encodeURIComponent(tokenString)}`);
      await setStorePushToken(null);
      return true;
    } catch {
      return false;
    }
  }, [token, setStorePushToken]);

  // Set badge count
  const setBadgeCount = useCallback(async (count: number) => {
    await Notifications.setBadgeCountAsync(count);
  }, []);

  // Initialize on mount
  useEffect(() => {
    requestPermissions();
  }, []);

  // Get token when permissions are granted
  useEffect(() => {
    if (permissionStatus === Notifications.PermissionStatus.GRANTED) {
      getPushToken();
    }
  }, [permissionStatus, getPushToken]);

  // Register token with backend when we have one
  useEffect(() => {
    if (pushToken && token) {
      registerToken(pushToken);
    }
  }, [pushToken, token, registerToken]);

  // Handle notification received (foreground)
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      // Update unread count
      const count = useNotificationStore.getState().unreadCount + 1;
      useNotificationStore.getState().setUnreadCount(count);

      // Set badge
      setBadgeCount(count);
    });

    return () => {
      subscription.remove();
    };
  }, [setBadgeCount]);

  // Handle notification response (tap)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as {
    action_url?: string;
    entity_type?: string;
    entity_id?: string;
  } | undefined;

    // Navigate to the action URL if provided
    if (data?.action_url) {
      router.push(data.action_url);
    }
  });

    return () => {
      subscription.remove();
    };
  }, []);

  return {
    pushToken,
    permissionStatus,
    requestPermissions,
    getPushToken,
    registerToken,
    unregisterToken,
    setBadgeCount,
  };
}
