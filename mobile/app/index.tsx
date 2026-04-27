import { Redirect } from 'expo-router';

import { useAuthStore } from '@/lib/auth-store';

export default function Index() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  // Render nothing while SecureStore is loading to avoid flash-redirect
  if (!isHydrated) return null;

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user?.role === 'client') {
    return <Redirect href="/(client)" />;
  }

  if (user?.role === 'partner') {
    return <Redirect href="/(partner)" />;
  }

  return <Redirect href="/(internal)" />;
}
