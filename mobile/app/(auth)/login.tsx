import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuthStore } from '@/lib/auth-store';
import { login, getMe } from '@/lib/api/auth';
import { useBiometrics } from '@/hooks/use-biometrics';
import {
  BiometricLoginButton,
  BiometricSetupPrompt,
} from '@/components/BiometricPrompt';

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showSetupPrompt, setShowSetupPrompt] = useState(false);
  const [setupCredentials, setSetupCredentials] = useState<{ email: string; password: string } | null>(null);

  const { status: biometricStatus, authenticate, refreshStatus } = useBiometrics();

  // Refresh biometric status on mount
  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  // Auto-trigger biometric auth if enabled and has stored credentials
  useEffect(() => {
    if (biometricStatus.isEnabled && biometricStatus.hasStoredCredentials && !loading && !biometricLoading) {
      // Small delay to let UI render first
      const timer = setTimeout(() => {
        void handleBiometricLogin();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, []); // Only run once on mount

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const tokenRes = await login({ email, password });
      if (tokenRes.mfa_required) {
        setError('MFA verification is required. Please use the web portal.');
        setLoading(false);
        return;
      }
      // Optimistically set auth so getMe() has a token
      await useAuthStore.getState().setAuth(tokenRes.access_token, tokenRes.refresh_token, {
        id: '',
        email,
        full_name: '',
        role: 'client',
        status: 'active',
      });
      const me = await getMe();
      await setAuth(tokenRes.access_token, tokenRes.refresh_token, {
        id: me.id,
        email: me.email,
        full_name: me.full_name,
        role: me.role,
        status: me.status,
      });

      // Show biometric setup prompt for first-time login
      if (!biometricStatus.promptShown && biometricStatus.isAvailable && biometricStatus.isEnrolled) {
        setSetupCredentials({ email, password });
        setShowSetupPrompt(true);
      } else {
        router.replace('/');
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = useCallback(async () => {
    if (!biometricStatus.isEnabled || !biometricStatus.hasStoredCredentials) {
      return;
    }

    setBiometricLoading(true);
    setError('');

    try {
      const creds = await authenticate();
      if (!creds) {
        // User cancelled or auth failed - they can use password
        setBiometricLoading(false);
        return;
      }

      // Pre-fill email for visual feedback
      setEmail(creds.email);

      setLoading(true);
      const tokenRes = await login({ email: creds.email, password: creds.password });

      if (tokenRes.mfa_required) {
        setError('MFA verification is required. Please use the web portal.');
        setLoading(false);
        setBiometricLoading(false);
        return;
      }

      await useAuthStore.getState().setAuth(tokenRes.access_token, tokenRes.refresh_token, {
        id: '',
        email: creds.email,
        full_name: '',
        role: 'client',
        status: 'active',
      });

      const me = await getMe();
      await setAuth(tokenRes.access_token, tokenRes.refresh_token, {
        id: me.id,
        email: me.email,
        full_name: me.full_name,
        role: me.role,
        status: me.status,
      });

      router.replace('/');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Biometric login failed. Please use your password.';
      setError(message);
      // Clear stored credentials on failure
      setPassword('');
    } finally {
      setLoading(false);
      setBiometricLoading(false);
    }
  }, [biometricStatus.isEnabled, biometricStatus.hasStoredCredentials, authenticate, setAuth, router]);

  const handleSetupComplete = () => {
    setShowSetupPrompt(false);
    setSetupCredentials(null);
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 32,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / Branding */}
          <View style={{ marginBottom: 48 }}>
            <Text style={{ fontSize: 36, fontWeight: '800', color: '#f8fafc', letterSpacing: -0.5 }}>
              AMG Portal
            </Text>
            <Text style={{ fontSize: 16, color: '#64748b', marginTop: 6 }}>
              Sign in to your account
            </Text>
          </View>

          {/* Error Banner */}
          {error ? (
            <View
              style={{
                backgroundColor: '#7f1d1d',
                borderRadius: 10,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 14, color: '#fca5a5' }}>{error}</Text>
            </View>
          ) : null}

          {/* Biometric Login Button - Show if enabled */}
          {biometricStatus.isEnabled && biometricStatus.hasStoredCredentials && (
            <View style={{ marginBottom: 24 }}>
              <BiometricLoginButton
                onPress={handleBiometricLogin}
                authType={biometricStatus.authType}
                isLoading={biometricLoading}
              />
            </View>
          )}

          {/* Divider when biometric is available */}
          {biometricStatus.isEnabled && biometricStatus.hasStoredCredentials && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: '#334155' }} />
              <Text style={{ color: '#64748b', fontSize: 12, marginHorizontal: 12 }}>or use password</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: '#334155' }} />
            </View>
          )}

          {/* Email Field */}
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#94a3b8', marginBottom: 6 }}>
              Email
            </Text>
            <TextInput
              style={{
                backgroundColor: '#1e293b',
                borderRadius: 10,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 16,
                color: '#f8fafc',
                borderWidth: 1,
                borderColor: '#334155',
              }}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#475569"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
              editable={!loading && !biometricLoading}
            />
          </View>

          {/* Password Field */}
          <View style={{ marginBottom: 28 }}>
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#94a3b8', marginBottom: 6 }}>
              Password
            </Text>
            <TextInput
              style={{
                backgroundColor: '#1e293b',
                borderRadius: 10,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 16,
                color: '#f8fafc',
                borderWidth: 1,
                borderColor: '#334155',
              }}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#475569"
              secureTextEntry
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              editable={!loading && !biometricLoading}
            />
          </View>

          {/* Submit Button */}
          <Pressable
            onPress={handleLogin}
            disabled={loading || biometricLoading}
            style={{
              backgroundColor: loading || biometricLoading ? '#854d0e' : '#eab308',
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            {loading && <ActivityIndicator size="small" color="#0f172a" />}
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Text>
          </Pressable>

          {/* Forgot Password Link */}
          <Pressable
            onPress={() => router.push('/(auth)/forgot-password')}
            style={{ marginTop: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#6366f1', fontSize: 14 }}>Forgot password?</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Biometric Setup Prompt */}
      {showSetupPrompt && setupCredentials && (
        <BiometricSetupPrompt
          email={setupCredentials.email}
          password={setupCredentials.password}
          onComplete={handleSetupComplete}
        />
      )}
    </SafeAreaView>
  );
}
