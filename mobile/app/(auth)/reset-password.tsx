import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle, Eye, EyeOff } from 'lucide-react-native';

import { resetPassword } from '@/lib/api/auth';

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number')
      .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetFormData = z.infer<typeof resetSchema>;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ResetFormData) => {
    if (!token) {
      setError('Invalid reset link.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await resetPassword(token, data.password);
      setSuccess(true);
    } catch {
      setError('Failed to reset password. The link may have expired.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle color="#16a34a" size={32} />
        </View>
        <Text className="text-xl font-bold text-foreground">Password Reset</Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">
          Your password has been updated. You can now sign in with your new password.
        </Text>
        <Pressable
          onPress={() => router.replace('/(auth)/login')}
          className="mt-6 w-full items-center rounded-lg bg-primary py-4"
        >
          <Text className="text-base font-semibold text-primary-foreground">Sign In</Text>
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
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
          className="px-8"
        >
          <View className="mb-8">
            <Text className="text-2xl font-bold text-foreground">Create New Password</Text>
            <Text className="mt-2 text-sm text-muted-foreground">
              Your new password must meet the requirements below.
            </Text>
          </View>

          {error ? (
            <View className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <Text className="text-center text-sm text-destructive">{error}</Text>
            </View>
          ) : null}

          <View className="mb-4">
            <Text className="mb-1.5 text-sm font-medium text-foreground">New Password</Text>
            <View className="relative">
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className="rounded-lg border border-border bg-card px-4 py-3.5 pr-12 text-base text-foreground"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="••••••••"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry={!showPassword}
                    autoComplete="new-password"
                    editable={!isLoading}
                  />
                )}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-3.5"
                hitSlop={8}
              >
                {showPassword ? (
                  <EyeOff color="#94a3b8" size={20} />
                ) : (
                  <Eye color="#94a3b8" size={20} />
                )}
              </Pressable>
            </View>
            {errors.password ? (
              <Text className="mt-1 text-xs text-destructive">{errors.password.message}</Text>
            ) : null}
          </View>

          <View className="mb-4">
            <Text className="mb-1 text-xs text-muted-foreground">Requirements:</Text>
            <Text className="text-xs text-muted-foreground">
              • At least 8 characters{'\n'}• One uppercase letter{'\n'}• One number{'\n'}• One
              special character
            </Text>
          </View>

          <View className="mb-6">
            <Text className="mb-1.5 text-sm font-medium text-foreground">Confirm Password</Text>
            <View className="relative">
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className="rounded-lg border border-border bg-card px-4 py-3.5 pr-12 text-base text-foreground"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="••••••••"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry={!showConfirm}
                    autoComplete="new-password"
                    editable={!isLoading}
                  />
                )}
              />
              <Pressable
                onPress={() => setShowConfirm((prev) => !prev)}
                className="absolute right-3 top-3.5"
                hitSlop={8}
              >
                {showConfirm ? (
                  <EyeOff color="#94a3b8" size={20} />
                ) : (
                  <Eye color="#94a3b8" size={20} />
                )}
              </Pressable>
            </View>
            {errors.confirmPassword ? (
              <Text className="mt-1 text-xs text-destructive">
                {errors.confirmPassword.message}
              </Text>
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
                Reset Password
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
