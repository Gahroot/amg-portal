import { useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

import { useAuthStore } from '@/lib/auth-store';
import { refreshToken as refreshTokenApi } from '@/lib/api/auth';
import { parseJwtExp } from '@/lib/utils';

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const BACKGROUND_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const REAUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes - require biometric re-auth after this

const LAST_ACTIVITY_KEY = 'amg_last_activity';
const BIOMETRIC_ENABLED_KEY = 'amg_biometric_enabled';

export function useSession() {
  const token = useAuthStore((s) => s.token);
  const storedRefreshToken = useAuthStore((s) => s.refreshToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useAuthStore((s) => s.user);
  const backgroundTimestamp = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Update last activity timestamp
  const updateActivity = useCallback(async () => {
    lastActivityRef.current = Date.now();
    await SecureStore.setItemAsync(LAST_ACTIVITY_KEY, Date.now().toString());
  }, []);

  // Check if biometric re-auth is required
  const checkBiometricReauthRequired = useCallback(async (): Promise<boolean> => {
    const biometricEnabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    if (biometricEnabled !== 'true') return false;

    const lastActivityStr = await SecureStore.getItemAsync(LAST_ACTIVITY_KEY);
    if (!lastActivityStr) return true;

    const lastActivity = parseInt(lastActivityStr, 10);
    return Date.now() - lastActivity > REAUTH_TIMEOUT_MS;
  }, []);

  // Token refresh logic
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

  // Background/foreground handling with biometric check
  useEffect(() => {
    const handleAppState = async (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundTimestamp.current = Date.now();
        await updateActivity();
      } else if (nextState === 'active') {
        const backgroundTime = backgroundTimestamp.current;
        backgroundTimestamp.current = null;

        if (backgroundTime) {
          const elapsed = Date.now() - backgroundTime;

          // Clear auth if backgrounded too long
          if (elapsed > BACKGROUND_TIMEOUT_MS) {
            await clearAuth();
            return;
          }

          // If biometric re-auth is needed, force the user through the login flow
          // instead of silently leaving a stale session behind.
          const needsReauth = await checkBiometricReauthRequired();
          if (needsReauth) {
            await SecureStore.setItemAsync('amg_needs_reauth', 'true');
            await clearAuth();
            router.replace('/(auth)/login');
            return;
          }
        }

        await updateActivity();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [clearAuth, updateActivity, checkBiometricReauthRequired]);

  // Track user activity (touches, etc.)
  useEffect(() => {
    const activityInterval = setInterval(() => {
      void updateActivity();
    }, 60_000); // Update every minute

    return () => clearInterval(activityInterval);
  }, [updateActivity]);

  // Initialize last activity on mount
  useEffect(() => {
    void updateActivity();
  }, [updateActivity]);
}

// Hook to check if re-authentication is required
export function useBiometricReauth() {
  const checkReauthRequired = useCallback(async (): Promise<boolean> => {
    const needsReauth = await SecureStore.getItemAsync('amg_needs_reauth');
    if (needsReauth === 'true') {
      await SecureStore.deleteItemAsync('amg_needs_reauth');
      return true;
    }
    return false;
  }, []);

  const markReauthComplete = useCallback(async () => {
    await SecureStore.setItemAsync(LAST_ACTIVITY_KEY, Date.now().toString());
  }, []);

  return { checkReauthRequired, markReauthComplete };
}
