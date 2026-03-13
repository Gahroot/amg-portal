import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useNotificationStore } from '@/lib/notification-store';

// Configure foreground notification handler — must be called at module level
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Set up Android notification channel
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0f172a',
  });
}

export function usePushNotifications() {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<Notifications.PermissionStatus | null>(null);
  const token = useAuthStore((s) => s.token);
  const setStorePushToken = useNotificationStore((s) => s.setPushToken);

  // Request permissions
  const requestPermissions = useCallback(async () => {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;
    if (existingStatus !== Notifications.PermissionStatus.GRANTED) {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    setPermissionStatus(finalStatus);
    return finalStatus === Notifications.PermissionStatus.GRANTED;
  }, []);

  // Get Expo push token
  const getPushToken = useCallback(async () => {
    if (permissionStatus !== Notifications.PermissionStatus.GRANTED) {
      return null;
    }

    // Push tokens only work on physical devices
    if (!Device.isDevice) {
      return null;
    }

    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      const { data: tokenString } = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );

      setPushToken(tokenString);
      return tokenString;
    } catch {
      return null;
    }
  }, [permissionStatus]);

  // Register token with backend
  const registerPushToken = useCallback(
    async (tokenString: string) => {
      if (!token) {
        return false;
      }

      try {
        await api.post('/push-tokens', {
          token: tokenString,
          platform: Platform.OS,
        });
        await setStorePushToken(tokenString);
        return true;
      } catch {
        return false;
      }
    },
    [token, setStorePushToken],
  );

  // Unregister token
  const unregisterToken = useCallback(
    async (tokenString: string) => {
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
    },
    [token, setStorePushToken],
  );

  // Set badge count
  const setBadgeCount = useCallback(async (count: number) => {
    await Notifications.setBadgeCountAsync(count);
  }, []);

  // Request permissions on mount
  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

  // Get token when permissions are granted
  useEffect(() => {
    if (permissionStatus === Notifications.PermissionStatus.GRANTED) {
      getPushToken();
    }
  }, [permissionStatus, getPushToken]);

  // Register token with backend when we have both push token and auth token
  useEffect(() => {
    if (pushToken && token) {
      registerPushToken(pushToken);
    }
  }, [pushToken, token, registerPushToken]);

  return {
    pushToken,
    permissionStatus,
    requestPermissions,
    registerPushToken,
    unregisterToken,
    setBadgeCount,
  };
}
