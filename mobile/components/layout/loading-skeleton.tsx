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

interface LoadingListProps {
  count?: number;
  className?: string;
}

export function LoadingList({ count = 3, className }: LoadingListProps) {
  return (
    <View className={cn('gap-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} className="rounded-lg border border-border bg-card p-4">
          <LoadingSkeleton width="60%" height={16} className="mb-2" />
          <LoadingSkeleton width="80%" height={12} className="mb-3" />
          <View className="flex-row gap-2">
            <LoadingSkeleton width={60} height={24} borderRadius={12} />
            <LoadingSkeleton width={80} height={24} borderRadius={12} />
          </View>
        </View>
      ))}
    </View>
  );
}
