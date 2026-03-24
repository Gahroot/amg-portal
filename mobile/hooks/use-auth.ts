import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { AxiosError } from 'axios';

import { useAuthStore } from '@/lib/auth-store';
import { type UserRole } from '@/types/user';
import * as authApi from '@/lib/api/auth';

function getRouteForRole(role: UserRole): '/(client)' | '/(partner)' | '/(internal)' {
  if (role === 'client') return '/(client)';
  if (role === 'partner') return '/(partner)';
  return '/(internal)';
}

function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export function useAuth() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const setMfaPending = useAuthStore((s) => s.setMfaPending);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      setIsLoading(true);
      try {
        const tokenRes = await authApi.login({ email, password });
        if (tokenRes.mfa_required) {
          useAuthStore.getState().setPendingCredentials({ email, password });
          setMfaPending({ accessToken: tokenRes.access_token, refreshToken: tokenRes.refresh_token });
          router.push('/(auth)/mfa-verify');
          return;
        }
        // Store token temporarily so getMe() works
        await setAuth(tokenRes.access_token, tokenRes.refresh_token, {
          id: '',
          email,
          full_name: '',
          role: 'client',
          status: 'active',
        });
        const me = await authApi.getMe();
        await setAuth(tokenRes.access_token, tokenRes.refresh_token, {
          id: me.id,
          email: me.email,
          full_name: me.full_name,
          role: me.role,
          status: me.status,
        });
        router.replace(getRouteForRole(me.role));
      } catch (err) {
        setError(getApiErrorMessage(err, 'Login failed. Please try again.'));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [router, setAuth, setMfaPending],
  );

  const verifyMfa = useCallback(
    async (code: string) => {
      setError(null);
      setIsLoading(true);
      try {
        const pendingCreds = useAuthStore.getState().pendingCredentials;
        if (!pendingCreds) {
          throw new Error('No pending MFA session.');
        }
        const tokenRes = await authApi.login({
          email: pendingCreds.email,
          password: pendingCreds.password,
          mfa_code: code,
        });
        await setAuth(tokenRes.access_token, tokenRes.refresh_token, {
          id: '',
          email: pendingCreds.email,
          full_name: '',
          role: 'client',
          status: 'active',
        });
        const me = await authApi.getMe();
        await setAuth(tokenRes.access_token, tokenRes.refresh_token, {
          id: me.id,
          email: me.email,
          full_name: me.full_name,
          role: me.role,
          status: me.status,
        });
        router.replace(getRouteForRole(me.role));
      } catch (err) {
        setError(getApiErrorMessage(err, 'MFA verification failed.'));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [router, setAuth],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore — clear local state regardless
    }
    await clearAuth();
    router.replace('/(auth)/login');
  }, [router, clearAuth]);

  return { login, verifyMfa, logout, isLoading, error, setError };
}
