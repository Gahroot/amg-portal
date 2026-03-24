import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CheckCircle, Copy, ShieldCheck } from 'lucide-react-native';

import { setupMFA, verifyMFASetup, type MFASetupResponse } from '@/lib/api/auth';

type SetupStep = 'loading' | 'scan' | 'success' | 'error';

export default function MfaSetupScreen() {
  const router = useRouter();
  const [step, setStep] = useState<SetupStep>('loading');
  const [setupData, setSetupData] = useState<MFASetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initSetup() {
      try {
        const data = await setupMFA();
        if (!cancelled) {
          setSetupData(data);
          setStep('scan');
        }
      } catch {
        if (!cancelled) {
          setError('Failed to initialize MFA setup.');
          setStep('error');
        }
      }
    }

    void initSetup();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleVerify = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await verifyMFASetup(code);
      setStep('success');
    } catch {
      setError('Invalid verification code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#6366f1" />
        <Text className="mt-4 text-sm text-muted-foreground">Setting up MFA...</Text>
      </SafeAreaView>
    );
  }

  if (step === 'error') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
        <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="text-center text-sm text-destructive">
            {error ?? 'An unknown error occurred.'}
          </Text>
        </View>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-sm text-primary">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step === 'success') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle color="#16a34a" size={32} />
        </View>
        <Text className="text-xl font-bold text-foreground">MFA Enabled</Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">
          Your account is now protected with two-factor authentication.
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-6 w-full items-center rounded-lg bg-primary py-4"
        >
          <Text className="text-base font-semibold text-primary-foreground">Done</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          className="flex-1 px-6"
        >
          <View className="mb-6 mt-6 items-center">
            <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl bg-primary">
              <ShieldCheck color="#ffffff" size={28} />
            </View>
            <Text className="text-xl font-bold text-foreground">Set Up Two-Factor Auth</Text>
            <Text className="mt-1 text-center text-sm text-muted-foreground">
              Scan the QR code with your authenticator app
            </Text>
          </View>

          {setupData ? (
            <>
              <View className="mb-4 items-center rounded-lg border border-border bg-white p-4">
                <Image
                  source={{
                    uri: setupData.qr_code_uri,
                  }}
                  style={{ width: 200, height: 200 }}
                  resizeMode="contain"
                />
              </View>

              <View className="mb-6">
                <Text className="mb-1 text-sm font-medium text-muted-foreground">
                  Manual entry key
                </Text>
                <View className="flex-row items-center rounded-lg border border-border bg-card px-3 py-2.5">
                  <Text className="flex-1 font-mono text-xs text-foreground" selectable>
                    {setupData.secret}
                  </Text>
                  <Copy color="#94a3b8" size={16} />
                </View>
              </View>

              <View className="mb-6">
                <Text className="mb-2 text-sm font-semibold text-foreground">Backup Codes</Text>
                <Text className="mb-2 text-xs text-muted-foreground">
                  Save these codes securely. Each can only be used once.
                </Text>
                <View className="flex-row flex-wrap gap-2 rounded-lg border border-border bg-card p-3">
                  {setupData.backup_codes.map((backupCode) => (
                    <View key={backupCode} className="rounded bg-muted px-2 py-1">
                      <Text className="font-mono text-xs text-foreground">{backupCode}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : null}

          {error ? (
            <View className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <Text className="text-center text-sm text-destructive">{error}</Text>
            </View>
          ) : null}

          <View className="mb-4">
            <Text className="mb-1.5 text-sm font-medium text-foreground">Verification Code</Text>
            <TextInput
              className="rounded-lg border border-border bg-card px-4 py-3.5 text-center text-lg tracking-widest text-foreground"
              value={code}
              onChangeText={setCode}
              placeholder="000000"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              maxLength={8}
              editable={!isSubmitting}
            />
            <Text className="mt-1 text-xs text-muted-foreground">
              Enter the 6-digit code from your authenticator app
            </Text>
          </View>

          <Pressable
            onPress={handleVerify}
            disabled={isSubmitting || code.length < 6}
            className="items-center rounded-lg bg-primary py-4"
            style={isSubmitting || code.length < 6 ? { opacity: 0.5 } : undefined}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-base font-semibold text-primary-foreground">
                Verify and Enable MFA
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
