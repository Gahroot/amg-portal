import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuthStore } from '@/lib/auth-store';
import { login, getMe } from '@/lib/api/auth';

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const tokenRes = await login({ email, password });
      if (tokenRes.mfa_required) {
        setError('MFA verification required.');
        setLoading(false);
        return;
      }
      await useAuthStore.getState().setAuth(tokenRes.access_token, {
        id: '',
        email,
        full_name: '',
        role: 'client',
        status: 'active',
      });
      const me = await getMe();
      await setAuth(tokenRes.access_token, {
        id: me.id,
        email: me.email,
        full_name: me.full_name,
        role: me.role,
        status: me.status,
      });
      router.replace('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-center px-8"
      >
        <View className="mb-12">
          <Text className="text-4xl font-bold text-primary-foreground">AMG Portal</Text>
          <Text className="mt-2 text-lg text-muted-foreground">Sign in to continue</Text>
        </View>

        {error ? (
          <View className="mb-4 rounded-lg bg-destructive/20 p-3">
            <Text className="text-sm text-destructive">{error}</Text>
          </View>
        ) : null}

        <View className="mb-4">
          <Text className="mb-1 text-sm text-primary-foreground">Email</Text>
          <TextInput
            className="rounded-lg border border-border bg-card p-4 text-foreground"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </View>

        <View className="mb-6">
          <Text className="mb-1 text-sm text-primary-foreground">Password</Text>
          <TextInput
            className="rounded-lg border border-border bg-card p-4 text-foreground"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password"
          />
        </View>

        <Pressable
          onPress={handleLogin}
          disabled={loading}
          className="rounded-lg bg-accent py-4"
        >
          <Text className="text-center text-lg font-semibold text-accent-foreground">
            {loading ? 'Signing in...' : 'Sign In'}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
