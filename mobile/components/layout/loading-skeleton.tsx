import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';

import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  className?: string;
}

export function LoadingSkeleton({ width = '100%', height = 20, borderRadius = 8, className }: LoadingSkeletonProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View className={cn('overflow-hidden', className)}>
      <Animated.View
        style={[
          {
            width: typeof width === 'number' ? width : undefined,
            height,
            borderRadius,
            backgroundColor: '#e2e8f0',
          },
          typeof width === 'string' ? { width: '100%' as unknown as number } : {},
          animatedStyle,
        ]}
      />
    </View>
  );
}
