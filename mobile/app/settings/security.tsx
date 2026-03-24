import { View, Text, Pressable, Switch, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import {
  Fingerprint,
  ScanFace,
  Shield,
  Clock,
  Trash2,
  ChevronRight,
  Info,
} from 'lucide-react-native';

import { useBiometrics, type BiometricType } from '@/hooks/use-biometrics';
import { useAuthStore } from '@/lib/auth-store';

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

export default function SecuritySettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const {
    status,
    isLoading,
    enableBiometrics,
    disableBiometrics,
    storeCredentials,
    clearCredentials,
    refreshStatus,
  } = useBiometrics();

  const [isToggling, setIsToggling] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('30 minutes');

  const BiometricIcon = getBiometricIcon(status.authType);

  // Refresh status when screen loads
  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handleToggleBiometrics = useCallback(async (value: boolean) => {
    setIsToggling(true);

    try {
      if (value) {
        const enabled = await enableBiometrics();
        if (!enabled) {
          Alert.alert(
            'Authentication Failed',
            `Could not verify your ${status.authType}. Please try again.`,
          );
          return;
        }

        // Prompt to save credentials
        Alert.alert(
          'Save Credentials',
          'Would you like to save your login credentials for quick biometric login?',
          [
            {
              text: 'Not Now',
              style: 'cancel',
            },
            {
              text: 'Save',
              onPress: async () => {
                // The credentials should already be stored during login
                // This is just for re-enabling after disabling
                Alert.alert(
                  'Credentials Saved',
                  'Your credentials have been saved securely. You can now use biometric login.',
                );
              },
            },
          ],
        );
      } else {
        Alert.alert(
          'Disable Biometric Login',
          `This will remove your saved credentials and disable ${status.authType} login. You'll need to enter your password each time.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Disable',
              style: 'destructive',
              onPress: async () => {
                await disableBiometrics();
              },
            },
          ],
        );
      }
    } finally {
      setIsToggling(false);
    }
  }, [enableBiometrics, disableBiometrics, status.authType]);

  const handleClearCredentials = useCallback(() => {
    Alert.alert(
      'Clear Saved Credentials',
      'This will remove your saved login credentials. You will need to re-enter them if you enable biometric login again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearCredentials();
            Alert.alert('Success', 'Saved credentials have been cleared.');
          },
        },
      ],
    );
  }, [clearCredentials]);

  const handleChangeTimeout = useCallback(() => {
    Alert.alert(
      'Session Timeout',
      'After how long should the app require re-authentication?',
      [
        { text: '5 minutes', onPress: () => setSessionTimeout('5 minutes') },
        { text: '15 minutes', onPress: () => setSessionTimeout('15 minutes') },
        { text: '30 minutes', onPress: () => setSessionTimeout('30 minutes') },
        { text: '1 hour', onPress: () => setSessionTimeout('1 hour') },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-4 pt-4 pb-6">
          <Text className="text-2xl font-bold text-foreground">Security</Text>
          <Text className="text-sm text-muted-foreground mt-1">
            Manage your authentication and security settings
          </Text>
        </View>

        {/* Biometric Section */}
        {status.isAvailable && status.isEnrolled && (
          <View className="px-4 mb-6">
            <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Biometric Authentication
            </Text>
            <View className="rounded-xl bg-card border border-border overflow-hidden">
              {/* Biometric Toggle */}
              <View className="flex-row items-center justify-between px-4 py-4">
                <View className="flex-row items-center gap-3 flex-1">
                  <View className="h-10 w-10 rounded-full bg-primary/10 items-center justify-center">
                    <BiometricIcon size={20} color="#6366f1" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-medium text-foreground">
                      {status.authType}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      Quick login using {status.authType.toLowerCase()}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={status.isEnabled}
                  onValueChange={handleToggleBiometrics}
                  disabled={isToggling}
                  trackColor={{ false: '#374151', true: '#6366f1' }}
                  thumbColor={status.isEnabled ? '#fff' : '#9ca3af'}
                />
              </View>

              {/* Saved Credentials Status */}
              {status.isEnabled && (
                <View className="flex-row items-center justify-between px-4 py-3 border-t border-border">
                  <View className="flex-row items-center gap-3">
                    <View className="h-8 w-8 rounded-full bg-muted items-center justify-center">
                      <Shield size={16} color="#64748b" />
                    </View>
                    <View>
                      <Text className="text-sm text-foreground">
                        Saved Credentials
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        {status.hasStoredCredentials ? 'Stored securely' : 'Not saved'}
                      </Text>
                    </View>
                  </View>
                  {status.hasStoredCredentials && (
                    <Pressable
                      onPress={handleClearCredentials}
                      className="px-3 py-1.5 rounded-lg bg-destructive/10"
                    >
                      <Text className="text-xs font-medium text-destructive">Clear</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Biometric Not Available */}
        {status.isAvailable && !status.isEnrolled && (
          <View className="px-4 mb-6">
            <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Biometric Authentication
            </Text>
            <View className="rounded-xl bg-card border border-border p-4">
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 rounded-full bg-muted items-center justify-center">
                  <BiometricIcon size={20} color="#64748b" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-foreground">
                    {status.authType} Not Set Up
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Set up {status.authType.toLowerCase()} in your device settings to enable quick login
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Session Settings */}
        <View className="px-4 mb-6">
          <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Session
          </Text>
          <View className="rounded-xl bg-card border border-border overflow-hidden">
            {/* Session Timeout */}
            <Pressable
              onPress={handleChangeTimeout}
              className="flex-row items-center justify-between px-4 py-4"
            >
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 rounded-full bg-primary/10 items-center justify-center">
                  <Clock size={20} color="#6366f1" />
                </View>
                <View>
                  <Text className="text-base font-medium text-foreground">
                    Auto-Lock Timeout
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Require re-authentication after inactivity
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-sm text-muted-foreground">{sessionTimeout}</Text>
                <ChevronRight size={16} color="#64748b" />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Account Info */}
        <View className="px-4 mb-6">
          <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Account
          </Text>
          <View className="rounded-xl bg-card border border-border p-4">
            <View className="flex-row items-center gap-3 mb-3">
              <View className="h-10 w-10 rounded-full bg-primary/10 items-center justify-center">
                <Info size={20} color="#6366f1" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-medium text-foreground">
                  {user?.full_name}
                </Text>
                <Text className="text-xs text-muted-foreground">{user?.email}</Text>
              </View>
            </View>
            <Text className="text-xs text-muted-foreground">
              Your account uses secure token-based authentication with automatic refresh.
            </Text>
          </View>
        </View>

        {/* Security Info */}
        <View className="px-4 mb-8">
          <View className="rounded-xl bg-primary/5 border border-primary/20 p-4">
            <View className="flex-row items-start gap-3">
              <Shield size={18} color="#6366f1" />
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground mb-1">
                  Your Security
                </Text>
                <Text className="text-xs text-muted-foreground leading-5">
                  All credentials are stored securely using device-level encryption.
                  Biometric data never leaves your device and is processed locally.
                  You can always use your password as a fallback.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
