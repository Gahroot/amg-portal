import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuthStore } from '@/lib/auth-store';
import { refreshToken as refreshTokenApi } from '@/lib/api/auth';

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const BACKGROUND_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function parseJwtExp(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload));
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function useSession() {
  const token = useAuthStore((s) => s.token);
  const storedRefreshToken = useAuthStore((s) => s.refreshToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useAuthStore((s) => s.user);
  const backgroundTimestamp = useRef<number | null>(null);

  useEffect(() => {
    if (!token) return;

    const tryRefresh = async () => {
      const exp = parseJwtExp(token);
      if (!exp) return;

      const remaining = exp - Date.now();
      if (remaining < REFRESH_THRESHOLD_MS && storedRefreshToken) {
        try {
          const res = await refreshTokenApi(storedRefreshToken);
          if (user) {
            await setAuth(res.access_token, res.refresh_token, user);
          }
        } catch {
          await clearAuth();
        }
      }
    };

    void tryRefresh();

    const interval = setInterval(tryRefresh, 60_000);
    return () => clearInterval(interval);
  }, [token, storedRefreshToken, setAuth, clearAuth, user]);

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundTimestamp.current = Date.now();
      } else if (nextState === 'active') {
        if (
          backgroundTimestamp.current &&
          Date.now() - backgroundTimestamp.current > BACKGROUND_TIMEOUT_MS
        ) {
          void clearAuth();
        }
        backgroundTimestamp.current = null;
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [clearAuth]);
}
