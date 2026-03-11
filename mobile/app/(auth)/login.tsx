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
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Shield } from 'lucide-react-native';

import { useAuth } from '@/hooks/use-auth';

const loginSchema = z.object({
  email: z.email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, error, setError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password);
    } catch {
      // Error is already set in hook
    }
  };

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
          <View className="mb-12 items-center">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-primary">
              <Shield color="#ffffff" size={32} />
            </View>
            <Text className="text-3xl font-bold text-foreground">AMG Portal</Text>
            <Text className="mt-2 text-base text-muted-foreground">Sign in to continue</Text>
          </View>

          {error ? (
            <View className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <Text className="text-center text-sm text-destructive">{error}</Text>
            </View>
          ) : null}

          <View className="mb-4">
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

          <View className="mb-2">
            <Text className="mb-1.5 text-sm font-medium text-foreground">Password</Text>
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
                    autoComplete="password"
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

          <Pressable
            onPress={() => {
              setError(null);
              router.push('/(auth)/forgot-password');
            }}
            className="mb-6 self-end"
          >
            <Text className="text-sm text-primary">Forgot password?</Text>
          </Pressable>

          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            className="items-center rounded-lg bg-primary py-4"
            style={isLoading ? { opacity: 0.7 } : undefined}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-base font-semibold text-primary-foreground">Sign In</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
