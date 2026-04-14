import { useCallback, useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { useAuthStore } from '@/lib/auth-store';
import { getMe } from '@/lib/api/auth';

// Storage keys
const BIOMETRIC_ENABLED_KEY = 'amg_biometric_enabled';
const BIOMETRIC_CREDS_KEY = 'amg_biometric_creds';
const BIOMETRIC_LAST_AUTH_KEY = 'amg_biometric_last_auth';
const BIOMETRIC_PROMPT_SHOWN_KEY = 'amg_biometric_prompt_shown';

// Security settings
const REAUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes for re-auth on sensitive actions
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes session timeout

export type BiometricType = 'Face ID' | 'Touch ID' | 'Fingerprint' | 'Face Recognition' | 'Iris' | 'Biometric' | 'None';

export interface BiometricStatus {
  isAvailable: boolean;
  isEnrolled: boolean;
  isEnabled: boolean;
  authType: BiometricType;
  hasStoredCredentials: boolean;
  promptShown: boolean;
}

export interface BiometricCredentials {
  email: string;
  password: string;
}

export function useBiometrics() {
  const [status, setStatus] = useState<BiometricStatus>({
    isAvailable: false,
    isEnrolled: false,
    isEnabled: false,
    authType: 'None',
    hasStoredCredentials: false,
    promptShown: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Check biometric availability and status
  const checkStatus = useCallback(async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      let authType: BiometricType = 'Biometric';
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        authType = Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        authType = Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        authType = 'Iris';
      }

      const isEnabledStr = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      const isEnabled = isEnabledStr === 'true';

      const storedCreds = await SecureStore.getItemAsync(BIOMETRIC_CREDS_KEY);
      const hasStoredCredentials = storedCreds !== null;

      const promptShownStr = await SecureStore.getItemAsync(BIOMETRIC_PROMPT_SHOWN_KEY);
      const promptShown = promptShownStr === 'true';

      setStatus({
        isAvailable: hasHardware,
        isEnrolled,
        isEnabled: isEnabled && isEnrolled && hasHardware,
        authType: hasHardware && isEnrolled ? authType : 'None',
        hasStoredCredentials,
        promptShown,
      });
    } catch {
      setStatus({
        isAvailable: false,
        isEnrolled: false,
        isEnabled: false,
        authType: 'None',
        hasStoredCredentials: false,
        promptShown: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  // Enable biometric authentication
  const enableBiometrics = useCallback(async (): Promise<boolean> => {
    if (!status.isAvailable || !status.isEnrolled) {
      return false;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Enable ${status.authType} for AMG Portal`,
        fallbackLabel: 'Cancel',
        disableDeviceFallback: true,
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
        setStatus((prev) => ({ ...prev, isEnabled: true }));
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }, [status.isAvailable, status.isEnrolled, status.authType]);

  // Disable biometric authentication
  const disableBiometrics = useCallback(async (): Promise<void> => {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'false');
    await SecureStore.deleteItemAsync(BIOMETRIC_CREDS_KEY);
    setStatus((prev) => ({
      ...prev,
      isEnabled: false,
      hasStoredCredentials: false,
    }));
  }, []);

  // Store credentials securely (called after successful password login)
  const storeCredentials = useCallback(async (email: string, password: string): Promise<void> => {
    const creds: BiometricCredentials = { email, password };
    await SecureStore.setItemAsync(BIOMETRIC_CREDS_KEY, JSON.stringify(creds));
    setStatus((prev) => ({ ...prev, hasStoredCredentials: true }));
  }, []);

  // Get stored credentials
  const getCredentials = useCallback(async (): Promise<BiometricCredentials | null> => {
    if (!status.isEnabled) {
      return null;
    }

    try {
      const credsStr = await SecureStore.getItemAsync(BIOMETRIC_CREDS_KEY);
      if (!credsStr) return null;

      return JSON.parse(credsStr) as BiometricCredentials;
    } catch {
      return null;
    }
  }, [status.isEnabled]);

  // Clear stored credentials
  const clearCredentials = useCallback(async (): Promise<void> => {
    await SecureStore.deleteItemAsync(BIOMETRIC_CREDS_KEY);
    setStatus((prev) => ({ ...prev, hasStoredCredentials: false }));
  }, []);

  // Authenticate with biometric (for login)
  const authenticate = useCallback(async (): Promise<BiometricCredentials | null> => {
    if (!status.isAvailable || !status.isEnrolled || !status.isEnabled) {
      return null;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to AMG Portal',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        // Biometric unlock must not bypass server-side session invalidation
        // (password change, remote logout) — probe /auth/me before trusting creds.
        try {
          await getMe();
        } catch (err: unknown) {
          const status401 =
            typeof err === 'object' &&
            err !== null &&
            'response' in err &&
            (err as { response?: { status?: number } }).response?.status === 401;
          if (status401) {
            await SecureStore.deleteItemAsync(BIOMETRIC_CREDS_KEY);
            await useAuthStore.getState().clearAuth();
            setStatus((prev) => ({ ...prev, hasStoredCredentials: false }));
            return null;
          }
          return null;
        }

        await SecureStore.setItemAsync(BIOMETRIC_LAST_AUTH_KEY, Date.now().toString());
        return getCredentials();
      }

      return null;
    } catch {
      return null;
    }
  }, [status.isAvailable, status.isEnrolled, status.isEnabled, getCredentials]);

  // Re-authenticate for sensitive actions (with timeout check)
  const reauthenticate = useCallback(
    async (reason: string = 'Confirm your identity'): Promise<boolean> => {
      if (!status.isAvailable || !status.isEnrolled) {
        return false;
      }

      // Check if recent auth exists
      try {
        const lastAuthStr = await SecureStore.getItemAsync(BIOMETRIC_LAST_AUTH_KEY);
        if (lastAuthStr) {
          const lastAuth = parseInt(lastAuthStr, 10);
          if (Date.now() - lastAuth < REAUTH_TIMEOUT_MS) {
            return true; // Recent auth still valid
          }
        }
      } catch {
        // Continue with re-auth
      }

      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: reason,
          fallbackLabel: 'Cancel',
          disableDeviceFallback: true,
          cancelLabel: 'Cancel',
        });

        if (result.success) {
          await SecureStore.setItemAsync(BIOMETRIC_LAST_AUTH_KEY, Date.now().toString());
          return true;
        }

        return false;
      } catch {
        return false;
      }
    },
    [status.isAvailable, status.isEnrolled],
  );

  // Check if session has timed out (requires re-auth)
  const checkSessionTimeout = useCallback(async (): Promise<boolean> => {
    try {
      const lastAuthStr = await SecureStore.getItemAsync(BIOMETRIC_LAST_AUTH_KEY);
      if (!lastAuthStr) return true;

      const lastAuth = parseInt(lastAuthStr, 10);
      return Date.now() - lastAuth > SESSION_TIMEOUT_MS;
    } catch {
      return true;
    }
  }, []);

  // Mark prompt as shown (for first login prompt)
  const markPromptShown = useCallback(async (): Promise<void> => {
    await SecureStore.setItemAsync(BIOMETRIC_PROMPT_SHOWN_KEY, 'true');
    setStatus((prev) => ({ ...prev, promptShown: true }));
  }, []);

  // Reset prompt state (for testing or logout)
  const resetPromptState = useCallback(async (): Promise<void> => {
    await SecureStore.deleteItemAsync(BIOMETRIC_PROMPT_SHOWN_KEY);
    setStatus((prev) => ({ ...prev, promptShown: false }));
  }, []);

  return {
    status,
    isLoading,
    enableBiometrics,
    disableBiometrics,
    storeCredentials,
    getCredentials,
    clearCredentials,
    authenticate,
    reauthenticate,
    checkSessionTimeout,
    markPromptShown,
    resetPromptState,
    refreshStatus: checkStatus,
  };
}
