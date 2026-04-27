import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';

import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/auth-store';

const CODE_LENGTH = 6;

export default function MfaVerifyScreen() {
  const router = useRouter();
  const { verifyMfa, isLoading, error, setError } = useAuth();
  const mfaPending = useAuthStore((s) => s.mfaPending);
  const clearMfaPending = useAuthStore((s) => s.clearMfaPending);
  const setPendingCredentials = useAuthStore((s) => s.setPendingCredentials);

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!mfaPending) {
      router.replace('/(auth)/login');
    }
  }, [mfaPending, router]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      if (isLoading) return;
      const sanitized = value.replace(/\D/g, '');
      const char = sanitized.slice(-1);

      setDigits((prev) => {
        const next = [...prev];
        next[index] = char;

        // Auto-submit when all digits filled
        const code = next.join('');
        if (code.length === CODE_LENGTH && next.every((d) => d !== '')) {
          setTimeout(() => {
            void handleSubmit(code);
          }, 50);
        }

        return next;
      });

      if (char && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [isLoading],
  );

  const handleKeyPress = useCallback(
    (index: number, key: string) => {
      if (key === 'Backspace' && digits[index] === '' && index > 0) {
        inputRefs.current[index - 1]?.focus();
        setDigits((prev) => {
          const next = [...prev];
          next[index - 1] = '';
          return next;
        });
      }
    },
    [digits],
  );

  const handleSubmit = async (code: string) => {
    try {
      await verifyMfa(code);
    } catch {
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = () => {
    setResendCooldown(60);
    setError(null);
    setDigits(Array(CODE_LENGTH).fill(''));
    inputRefs.current[0]?.focus();
  };

  const handleBack = () => {
    clearMfaPending();
    setPendingCredentials(null);
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-8">
          <View className="mb-10 items-center">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-primary">
              <ShieldCheck color="#ffffff" size={32} />
            </View>
            <Text className="text-2xl font-bold text-foreground">
              Two-Factor Authentication
            </Text>
            <Text className="mt-2 text-center text-sm text-muted-foreground">
              Enter the 6-digit code from your authenticator app
            </Text>
          </View>

          {error ? (
            <View className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <Text className="text-center text-sm text-destructive">{error}</Text>
            </View>
          ) : null}

          <View className="mb-6 flex-row justify-center gap-3">
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                className="h-14 w-12 rounded-lg border border-border bg-card text-center text-xl font-bold text-foreground"
                value={digit}
                onChangeText={(value) => handleDigitChange(index, value)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                editable={!isLoading}
              />
            ))}
          </View>

          {isLoading ? (
            <View className="mb-6 items-center">
              <ActivityIndicator size="small" color="#6366f1" />
              <Text className="mt-2 text-sm text-muted-foreground">Verifying...</Text>
            </View>
          ) : null}

          <Pressable onPress={handleResend} disabled={resendCooldown > 0} className="mb-8">
            <Text
              className={`text-center text-sm ${resendCooldown > 0 ? 'text-muted-foreground' : 'text-primary'}`}
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
            </Text>
          </Pressable>

          <Pressable onPress={handleBack} className="flex-row items-center justify-center gap-1">
            <ArrowLeft color="#6366f1" size={16} />
            <Text className="text-sm text-primary">Back to login</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
