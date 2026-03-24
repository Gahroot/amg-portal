import { View, Text, Switch, ActivityIndicator } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { Fingerprint, ScanFace } from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { useBiometrics, type BiometricType } from '@/hooks/use-biometrics';

const BIOMETRIC_PREF_KEY = 'amg_biometric_enabled';

function getBiometricIcon(authType: BiometricType) {
  switch (authType) {
    case 'Face ID':
    case 'Face Recognition':
      return ScanFace;
    case 'Touch ID':
    case 'Fingerprint':
      return Fingerprint;
    default:
      return Fingerprint;
  }
}

interface BiometricToggleProps {
  onToggle?: (enabled: boolean) => void;
  showStatus?: boolean;
}

export function BiometricToggle({ onToggle, showStatus = false }: BiometricToggleProps) {
  const {
    status,
    isLoading,
    enableBiometrics,
    disableBiometrics,
    refreshStatus,
  } = useBiometrics();
  const [localToggling, setLocalToggling] = useState(false);

  // Ensure status is checked on mount
  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const BiometricIcon = getBiometricIcon(status.authType);

  const handleToggle = useCallback(async (value: boolean) => {
    setLocalToggling(true);
    try {
      if (value) {
        const success = await enableBiometrics();
        if (onToggle) onToggle(success);
      } else {
        await disableBiometrics();
        if (onToggle) onToggle(false);
      }
    } finally {
      setLocalToggling(false);
    }
  }, [enableBiometrics, disableBiometrics, onToggle]);

  if (isLoading) {
    return (
      <View className="flex-row items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <View className="flex-row items-center gap-3">
          <ActivityIndicator size="small" color="#6366f1" />
          <Text className="text-sm font-medium text-foreground">Checking biometrics...</Text>
        </View>
      </View>
    );
  }

  if (!status.isAvailable || !status.isEnrolled) {
    return null;
  }

  return (
    <View className="rounded-lg border border-border bg-card overflow-hidden">
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-row items-center gap-3">
          <BiometricIcon size={20} color="#6366f1" />
          <View>
            <Text className="text-sm font-medium text-foreground">
              Use {status.authType}
            </Text>
            {showStatus && status.isEnabled && status.hasStoredCredentials && (
              <Text className="text-xs text-muted-foreground">
                Credentials saved
              </Text>
            )}
          </View>
        </View>
        <Switch
          value={status.isEnabled}
          onValueChange={handleToggle}
          disabled={localToggling}
          trackColor={{ false: '#374151', true: '#6366f1' }}
          thumbColor={status.isEnabled ? '#fff' : '#9ca3af'}
        />
      </View>
    </View>
  );
}

// Standalone authenticate function for external use
export async function authenticateWithBiometric(): Promise<boolean> {
  const pref = await SecureStore.getItemAsync(BIOMETRIC_PREF_KEY);
  if (pref !== 'true') return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Sign in to AMG Portal',
    fallbackLabel: 'Use Password',
    disableDeviceFallback: false,
  });

  return result.success;
}

// Re-export the hook for convenience
export { useBiometrics } from '@/hooks/use-biometrics';
