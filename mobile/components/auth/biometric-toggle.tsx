import { useEffect, useState } from 'react';
import { View, Text, Switch, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Fingerprint } from 'lucide-react-native';

const BIOMETRIC_PREF_KEY = 'amg_biometric_enabled';
const BIOMETRIC_CREDS_KEY = 'amg_biometric_creds';

export function BiometricToggle() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [authType, setAuthType] = useState<string>('Biometric');

  useEffect(() => {
    async function check() {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setIsAvailable(compatible && enrolled);

      if (compatible) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setAuthType('Face ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setAuthType('Touch ID');
        }
      }

      const pref = await SecureStore.getItemAsync(BIOMETRIC_PREF_KEY);
      setIsEnabled(pref === 'true');
    }

    void check();
  }, []);

  const handleToggle = async (value: boolean) => {
    if (value) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Enable ${authType} for AMG Portal`,
        fallbackLabel: 'Cancel',
        disableDeviceFallback: true,
      });

      if (result.success) {
        await SecureStore.setItemAsync(BIOMETRIC_PREF_KEY, 'true');
        setIsEnabled(true);
      } else {
        Alert.alert('Authentication Failed', `Could not verify ${authType}.`);
      }
    } else {
      await SecureStore.setItemAsync(BIOMETRIC_PREF_KEY, 'false');
      await SecureStore.deleteItemAsync(BIOMETRIC_CREDS_KEY);
      setIsEnabled(false);
    }
  };

  if (!isAvailable) return null;

  return (
    <View className="flex-row items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
      <View className="flex-row items-center gap-3">
        <Fingerprint color="#6366f1" size={20} />
        <Text className="text-sm font-medium text-foreground">Use {authType}</Text>
      </View>
      <Switch
        value={isEnabled}
        onValueChange={handleToggle}
        trackColor={{ false: '#d1d5db', true: '#818cf8' }}
        thumbColor={isEnabled ? '#6366f1' : '#f3f4f6'}
      />
    </View>
  );
}

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

export async function storeBiometricCredentials(email: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_CREDS_KEY, JSON.stringify({ email, password }));
}

export async function getBiometricCredentials(): Promise<{
  email: string;
  password: string;
} | null> {
  const creds = await SecureStore.getItemAsync(BIOMETRIC_CREDS_KEY);
  if (!creds) return null;
  try {
    return JSON.parse(creds) as { email: string; password: string };
  } catch {
    return null;
  }
}
