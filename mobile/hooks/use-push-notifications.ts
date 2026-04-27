import { useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';

import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useNotificationStore } from '@/lib/notification-store';
import { getRouteFromDeepLink, createDeepLinkFromEntity } from '@/utils/deepLinks';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface NotificationData {
  id?: string;
  type?: string;
  action_url?: string;
  deep_link?: string;
  action_label?: string;
  entity_type?: string;
  entity_id?: string;
  priority?: string;
}

export function usePushNotifications() {
  const [pushToken, setLocalPushToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Notifications.PermissionStatus | null>(null);
  const token = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const setStorePushToken = useNotificationStore((s) => s.setPushToken);
  const navigationHandledRef = useRef(false);

  // Android 8+ requires a notification channel before any notification can appear.
  // Without one the system silently drops all notifications.
  useEffect(() => {
    if (Platform.OS === 'android') {
      void Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#eab308',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }
  }, []);

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

    // SDK 49+ requires an explicit EAS projectId.
    // Priority: app.json extra.eas.projectId → EAS build-injected easConfig.projectId
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

    if (!projectId) {
      console.warn(
        '[PushToken] No EAS projectId found. Add extra.eas.projectId to app.json ' +
        'or run `eas init` to link this project. Push tokens will not be registered.',
      );
      return null;
    }

    try {
      const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
      const tokenString = tokenResult.data;
      if (tokenString) {
        setLocalPushToken(tokenString);
        return tokenString;
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

    // Backend validates platform ∈ {ios, android, web}; map RN's broader set.
    const platform: 'ios' | 'android' | 'web' =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

    try {
      await api.post('/push-tokens/', {
        token: tokenString,
        platform,
      });
      await setStorePushToken(tokenString);
      return true;
    } catch (err) {
      console.warn('[PushToken] Failed to register token with backend:', err);
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
    } catch (err) {
      console.warn('[PushToken] Failed to unregister token from backend:', err);
      return false;
    }
  }, [token, setStorePushToken]);

  // Set badge count
  const setBadgeCount = useCallback(async (count: number) => {
    await Notifications.setBadgeCountAsync(count);
  }, []);

  // Handle navigation from notification data
  const handleNotificationNavigation = useCallback((data: NotificationData | undefined) => {
    if (!data || navigationHandledRef.current) {
      return;
    }

    let route: string | null = null;

    // Priority 1: Use deep_link if provided
    if (data.deep_link) {
      route = getRouteFromDeepLink(data.deep_link);
    }

    // Priority 2: Construct from entity_type and entity_id
    if (!route && data.entity_type && data.entity_id) {
      const deepLink = createDeepLinkFromEntity(data.entity_type, data.entity_id);
      route = getRouteFromDeepLink(deepLink);
    }

    // Priority 3: Parse action_url (web-style path)
    if (!route && data.action_url) {
      route = getRouteFromDeepLink(data.action_url);
    }

    if (route) {
      navigationHandledRef.current = true;
      // Small delay to ensure navigation state is ready
      setTimeout(() => {
        router.push(route as any);
      }, 100);
    }
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
      // Reset navigation handled flag for new notifications
      navigationHandledRef.current = false;

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

  // Handle notification response (tap) - app in foreground or background
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as NotificationData | undefined;
      handleNotificationNavigation(data);
    });

    return () => {
      subscription.remove();
    };
  }, [handleNotificationNavigation]);

  // Handle cold start - app was opened via notification tap
  useEffect(() => {
    if (!isHydrated || !token) {
      return;
    }

    // Check if app was opened from a notification
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data as NotificationData | undefined;
        handleNotificationNavigation(data);

        // Clear the last notification response so we don't handle it again
        Notifications.clearLastNotificationResponseAsync();
      }
    });
  }, [isHydrated, token, handleNotificationNavigation]);

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
