import { View, Text } from 'react-native';

import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';
  className?: string;
}

const variants = {
  default: 'bg-primary',
  secondary: 'bg-secondary',
  outline: 'border border-border bg-transparent',
  success: 'bg-green-100',
  warning: 'bg-yellow-100',
  destructive: 'bg-red-100',
};

const textVariants = {
  default: 'text-primary-foreground',
  secondary: 'text-secondary-foreground',
  outline: 'text-foreground',
  success: 'text-green-700',
  warning: 'text-yellow-700',
  destructive: 'text-red-700',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <View className={cn('rounded-full px-2.5 py-0.5', variants[variant], className)}>
      <Text className={cn('text-xs font-medium', textVariants[variant])}>{children}</Text>
    </View>
  );
}
