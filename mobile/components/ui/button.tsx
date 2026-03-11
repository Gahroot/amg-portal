import { Pressable, Text, ActivityIndicator, type PressableProps } from 'react-native';

import { cn } from '@/lib/utils';

interface ButtonProps extends PressableProps {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg';
  loading?: boolean;
  className?: string;
  children: React.ReactNode;
}

const variants = {
  default: 'bg-primary',
  secondary: 'bg-secondary',
  outline: 'border border-border bg-transparent',
  ghost: 'bg-transparent',
  destructive: 'bg-destructive',
};

const sizes = {
  sm: 'px-3 py-2',
  default: 'px-4 py-3',
  lg: 'px-6 py-4',
};

const textVariants = {
  default: 'text-primary-foreground',
  secondary: 'text-secondary-foreground',
  outline: 'text-foreground',
  ghost: 'text-foreground',
  destructive: 'text-destructive-foreground',
};

export function Button({
  variant = 'default',
  size = 'default',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      className={cn(
        'flex-row items-center justify-center rounded-lg',
        variants[variant],
        sizes[size],
        (disabled || loading) && 'opacity-50',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? '#1e293b' : '#f8fafc'} />
      ) : (
        <Text className={cn('text-base font-semibold', textVariants[variant])}>{children}</Text>
      )}
    </Pressable>
  );
}
