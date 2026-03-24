import '../global.css';

import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';

import { OfflineIndicator } from '@/components/OfflineIndicator';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useAuthStore } from '@/lib/auth-store';
import { queryClient } from '@/lib/query-client';
import { dataCache } from '@/services/DataCache';
import { useWidgetIntegration } from '@/widgets';

/**
 * Setup network monitoring for TanStack Query
 */
function useNetworkManager() {
  useEffect(() => {
    // React Query supports auto-refetch on reconnect for web
    // For native, we need to manually integrate with NetInfo
    if (Platform.OS !== 'web') {
      const unsubscribe = NetInfo.addEventListener((state) => {
        const isOnline =
          state.isConnected != null &&
          state.isConnected &&
          Boolean(state.isInternetReachable);
        onlineManager.setOnline(isOnline);
      });

      return () => unsubscribe();
    }
  }, []);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Clear expired cache when app becomes active
        await dataCache.clearExpired();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);
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

  // Initialize network manager
  useNetworkManager();

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
            <WidgetManager />
            <StatusBar style="auto" />
            <OfflineIndicator position="top" showOnlineToast={true} />
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
