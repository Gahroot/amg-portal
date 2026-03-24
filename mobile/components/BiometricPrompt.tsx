import { View, Text, Pressable, ActivityIndicator, AppState, type AppStateStatus } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fingerprint, ScanFace, X } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import { useBiometrics, type BiometricType } from '@/hooks/use-biometrics';

interface BiometricPromptProps {
  visible: boolean;
  onEnable: () => Promise<void>;
  onSkip: () => void;
  authType: BiometricType;
}

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

function BiometricPromptModal({ visible, onEnable, onSkip, authType }: BiometricPromptProps) {
  const [isLoading, setIsLoading] = useState(false);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const Icon = getBiometricIcon(authType);

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      await onEnable();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, { damping: 20 });
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      scale.value = withTiming(0.9, { duration: 150 });
    }
  }, [visible, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <View className="absolute inset-0 z-50">
      <Animated.View
        style={backdropStyle}
        className="absolute inset-0 bg-black/70"
      />
      <SafeAreaView className="flex-1 items-center justify-center px-6">
        <Animated.View
          style={animatedStyle}
          className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl"
        >
          {/* Close button */}
          <Pressable
            onPress={onSkip}
            className="absolute right-4 top-4 rounded-full p-1"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color="#94a3b8" />
          </Pressable>

          {/* Icon */}
          <View className="items-center mb-4">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/20">
              <Icon size={32} color="#6366f1" />
            </View>
          </View>

          {/* Title & Description */}
          <Text className="text-center text-xl font-bold text-foreground mb-2">
            Enable {authType}?
          </Text>
          <Text className="text-center text-sm text-muted-foreground mb-6">
            Sign in quickly and securely using {authType}. You can always use your password as a fallback.
          </Text>

          {/* Benefits */}
          <View className="mb-6 space-y-2">
            <View className="flex-row items-center gap-2">
              <View className="h-1.5 w-1.5 rounded-full bg-primary" />
              <Text className="text-sm text-muted-foreground">Quick one-tap login</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="h-1.5 w-1.5 rounded-full bg-primary" />
              <Text className="text-sm text-muted-foreground">Industry-standard security</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="h-1.5 w-1.5 rounded-full bg-primary" />
              <Text className="text-sm text-muted-foreground">Password always available</Text>
            </View>
          </View>

          {/* Buttons */}
          <Pressable
            onPress={handleEnable}
            disabled={isLoading}
            className="rounded-xl bg-primary py-3.5 flex-row items-center justify-center gap-2 mb-3"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon size={18} color="#fff" />
                <Text className="text-base font-semibold text-primary-foreground">
                  Enable {authType}
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={onSkip}
            disabled={isLoading}
            className="py-2"
          >
            <Text className="text-center text-sm text-muted-foreground">
              Not now
            </Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

// First login prompt wrapper
export function BiometricSetupPrompt({
  email,
  password,
  onComplete,
}: {
  email: string;
  password: string;
  onComplete: () => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const { status, enableBiometrics, storeCredentials, markPromptShown } = useBiometrics();

  useEffect(() => {
    // Show prompt after a brief delay if biometrics available and not yet shown
    if (!status.isAvailable || !status.isEnrolled || status.promptShown) {
      return;
    }

    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [status.isAvailable, status.isEnrolled, status.promptShown]);

  const handleEnable = async () => {
    const enabled = await enableBiometrics();
    if (enabled) {
      await storeCredentials(email, password);
    }
    await markPromptShown();
    setShowPrompt(false);
    onComplete();
  };

  const handleSkip = async () => {
    await markPromptShown();
    setShowPrompt(false);
    onComplete();
  };

  // If biometrics not available, complete immediately
  useEffect(() => {
    if (!status.isAvailable || !status.isEnrolled) {
      onComplete();
    }
  }, [status.isAvailable, status.isEnrolled, onComplete]);

  return (
    <BiometricPromptModal
      visible={showPrompt}
      onEnable={handleEnable}
      onSkip={handleSkip}
      authType={status.authType}
    />
  );
}

// Login screen biometric button
export function BiometricLoginButton({
  onPress,
  authType,
  isLoading,
}: {
  onPress: () => void;
  authType: BiometricType;
  isLoading?: boolean;
}) {
  const Icon = getBiometricIcon(authType);

  return (
    <Pressable
      onPress={onPress}
      disabled={isLoading}
      className="flex-row items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 py-3.5"
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#6366f1" />
      ) : (
        <>
          <Icon size={20} color="#6366f1" />
          <Text className="text-base font-semibold text-primary">
            Sign in with {authType}
          </Text>
        </>
      )}
    </Pressable>
  );
}

// Re-authentication overlay (for sensitive actions)
export function BiometricReauthOverlay({
  visible,
  reason,
  onSuccess,
  onCancel,
}: {
  visible: boolean;
  reason: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { status, reauthenticate } = useBiometrics();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleAuthenticate = useCallback(async () => {
    setIsAuthenticating(true);
    const success = await reauthenticate(reason);
    setIsAuthenticating(false);

    if (success) {
      onSuccess();
    }
  }, [reason, reauthenticate, onSuccess]);

  useEffect(() => {
    if (visible && status.isAvailable) {
      void handleAuthenticate();
    }
  }, [visible, status.isAvailable, handleAuthenticate]);

  if (!visible) return null;

  return (
    <View className="absolute inset-0 z-50 bg-black/80 items-center justify-center">
      <View className="bg-card rounded-2xl p-6 mx-6 max-w-sm w-full items-center">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/20 mb-4">
          {isAuthenticating ? (
            <ActivityIndicator size="large" color="#6366f1" />
          ) : (
            <Fingerprint size={32} color="#6366f1" />
          )}
        </View>
        <Text className="text-lg font-semibold text-foreground mb-2">
          Authentication Required
        </Text>
        <Text className="text-sm text-muted-foreground text-center mb-4">
          {reason}
        </Text>
        {!isAuthenticating && (
          <Pressable onPress={onCancel} className="py-2">
            <Text className="text-sm text-primary">Cancel</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default BiometricPromptModal;
