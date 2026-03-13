import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useNotifications } from '@/hooks/use-notifications';
import { useAuthStore } from '@/lib/auth-store';
import { useNotificationStore } from '@/lib/notification-store';
import { queryClient } from '@/lib/query-client';

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const token = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  useEffect(() => {
    if (!isHydrated) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!token && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (token && inAuthGroup) {
      router.replace('/');
    }
  }, [token, isHydrated, segments, router]);

  return <>{children}</>;
}

/**
 * Initializes push notifications, WebSocket connection, and real-time
 * notification handling when the user is authenticated. Rendered only
 * when a token is present so hooks that depend on auth are safe.
 */
function NotificationInitializer() {
  const router = useRouter();
  const { fetchUnreadCount } = useNotifications();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const receivedListenerRef = useRef<Notifications.EventSubscription | null>(null);
  const responseListenerRef = useRef<Notifications.EventSubscription | null>(null);

  // Sync OS badge count whenever unread count changes
  useEffect(() => {
    Notifications.setBadgeCountAsync(unreadCount);
  }, [unreadCount]);

  // Listen for notifications received in the foreground
  useEffect(() => {
    receivedListenerRef.current = Notifications.addNotificationReceivedListener(
      () => {
        // The push-notifications hook already increments unreadCount in the
        // store, so we just refresh the server-side count to stay in sync.
        fetchUnreadCount();
      },
    );

    return () => {
      receivedListenerRef.current?.remove();
    };
  }, [fetchUnreadCount]);

  // Listen for notification taps and deep-link via the amg:// scheme
  useEffect(() => {
    responseListenerRef.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as
          | { action_url?: string }
          | undefined;

        if (data?.action_url) {
          // If the action_url is a full deep-link (amg://...) let Linking handle
          // it, otherwise push it as an in-app route.
          if (data.action_url.startsWith('amg://')) {
            Linking.openURL(data.action_url);
          } else {
            router.push(data.action_url);
          }
        }
      });

    return () => {
      responseListenerRef.current?.remove();
    };
  }, [router]);

  // Handle a notification response that launched the app from a cold start
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;

      const data = response.notification.request.content.data as
        | { action_url?: string }
        | undefined;

      if (data?.action_url) {
        if (data.action_url.startsWith('amg://')) {
          Linking.openURL(data.action_url);
        } else {
          router.push(data.action_url);
        }
      }
    });
  }, [router]);

  return null;
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    hydrate().then(() => {
      SplashScreen.hideAsync();
    });
  }, [hydrate]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          {token && <NotificationInitializer />}
          <AuthGate>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(client)" />
              <Stack.Screen name="(internal)" />
              <Stack.Screen name="(partner)" />
            </Stack>
          </AuthGate>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
