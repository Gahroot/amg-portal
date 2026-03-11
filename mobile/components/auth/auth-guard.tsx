import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { useAuthStore } from '@/lib/auth-store';
import { useSession } from '@/hooks/use-session';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  useSession();

  useEffect(() => {
    if (!isHydrated) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!token && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (token && inAuthGroup) {
      if (user?.role === 'client') {
        router.replace('/(client)');
      } else if (user?.role === 'partner') {
        router.replace('/(partner)');
      } else {
        router.replace('/(internal)');
      }
    }
  }, [token, isHydrated, segments, router, user]);

  useEffect(() => {
    if (isHydrated) {
      SplashScreen.hideAsync();
    }
  }, [isHydrated]);

  if (!isHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return <>{children}</>;
}
