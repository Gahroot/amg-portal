import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DeviceIntegrityGate } from '@/components/DeviceIntegrityGate';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useWebSocket } from '@/hooks/use-websocket';
import { useAuthStore } from '@/lib/auth-store';
import { queryClient } from '@/lib/query-client';
import { dataCache } from '@/services/DataCache';
import { useWidgetIntegration } from '@/widgets';

// onlineManager is wired to NetInfo once in query-client.ts via setEventListener.
// This hook handles only the app-lifecycle side-effect (cache eviction on foreground).
function useAppLifecycle() {
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        await dataCache.clearExpired();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);
}

// Manages the single shared WebSocket connection for real-time notifications.
// Must be inside QueryClientProvider (uses Zustand stores, not TQ — but keeping
// it co-located with other connection managers makes lifecycle obvious).
function ConnectionManager() {
  useWebSocket();
  return null;
}

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
 * Widget manager - initializes widget integration when user is authenticated
 */
function WidgetManager() {
  const token = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  // Only initialize widgets when user is authenticated
  useWidgetIntegration();

  return null;
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const [isReady, setIsReady] = useState(false);

  // App lifecycle (cache eviction on foreground)
  useAppLifecycle();

  // Initialize push notifications with deep link handling
  usePushNotifications();

  useEffect(() => {
    const initialize = async () => {
      // Initialize cache
      await dataCache.initialize();

      // Hydrate auth state
      await hydrate();

      setIsReady(true);
      SplashScreen.hideAsync();
    };

    initialize();
  }, [hydrate]);

  if (!isReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthGate>
            <DeviceIntegrityGate>
              <WidgetManager />
              <ConnectionManager />
              <StatusBar style="auto" />
              <OfflineIndicator position="top" showOnlineToast={true} />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(client)" />
                <Stack.Screen name="(internal)" />
                <Stack.Screen name="(partner)" />
              </Stack>
            </DeviceIntegrityGate>
          </AuthGate>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
