import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Mail } from 'lucide-react-native';

import { forgotPassword } from '@/lib/api/auth';

const schema = z.object({
  email: z.email('Please enter a valid email address'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: FormData) => {
    setError(null);
    setIsLoading(true);
    try {
      await forgotPassword(data.email);
      setSent(true);
    } catch {
      setError('Failed to send reset link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Mail color="#6366f1" size={32} />
        </View>
        <Text className="text-xl font-bold text-foreground">Check Your Email</Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">
          If an account exists with that email, we've sent a password reset link.
        </Text>
        <Pressable
          onPress={() => router.replace('/(auth)/login')}
          className="mt-6 w-full items-center rounded-lg bg-primary py-4"
        >
          <Text className="text-base font-semibold text-primary-foreground">Back to Login</Text>
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
        <View className="flex-1 justify-center px-8">
          <View className="mb-8">
            <Text className="text-2xl font-bold text-foreground">Reset Password</Text>
            <Text className="mt-2 text-sm text-muted-foreground">
              Enter your email and we'll send you a reset link.
            </Text>
          </View>

          {error ? (
            <View className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <Text className="text-center text-sm text-destructive">{error}</Text>
            </View>
          ) : null}

          <View className="mb-6">
            <Text className="mb-1.5 text-sm font-medium text-foreground">Email</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className="rounded-lg border border-border bg-card px-4 py-3.5 text-base text-foreground"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="you@example.com"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  editable={!isLoading}
                />
              )}
            />
            {errors.email ? (
              <Text className="mt-1 text-xs text-destructive">{errors.email.message}</Text>
            ) : null}
          </View>

          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            className="items-center rounded-lg bg-primary py-4"
            style={isLoading ? { opacity: 0.7 } : undefined}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-base font-semibold text-primary-foreground">
                Send Reset Link
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            className="mt-4 flex-row items-center justify-center gap-1"
          >
            <ArrowLeft color="#6366f1" size={16} />
            <Text className="text-sm text-primary">Back to login</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
