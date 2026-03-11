import { TextInput, View, type TextInputProps } from 'react-native';
import { Search } from 'lucide-react-native';

import { cn } from '@/lib/utils';

interface InputProps extends TextInputProps {
  className?: string;
}

export function Input({ className, ...props }: InputProps) {
  return (
    <TextInput
      className={cn(
        'rounded-lg border border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground',
        className,
      )}
      placeholderTextColor="#94a3b8"
      {...props}
    />
  );
}

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ value, onChangeText, placeholder = 'Search...', className }: SearchInputProps) {
  return (
    <View className={cn('relative', className)}>
      <View className="absolute left-3 top-1/2 -translate-y-1/2">
        <Search color="#94a3b8" size={18} />
      </View>
      <TextInput
        className="rounded-lg border border-border bg-card py-3 pl-10 pr-4 text-base text-foreground placeholder:text-muted-foreground"
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}
