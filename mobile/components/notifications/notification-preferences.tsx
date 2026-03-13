import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Switch, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bell, BellOff, Clock, Globe, Mail, ChevronDown } from 'lucide-react-native';

import { useNotifications } from '@/hooks/use-notifications';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingSkeleton } from '@/components/layout/loading-skeleton';
import { cn } from '@/lib/utils';
import { getNotificationPreferences } from '@/lib/api/notifications';
import type { NotificationPreference } from '@/types/notification';

const preferenceSchema = z.object({
  digest_enabled: z.boolean(),
  digest_frequency: z.enum(['immediate', 'hourly', 'daily', 'weekly', 'never']),
  quiet_hours_enabled: z.boolean(),
  quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format').optional(),
  quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format').optional(),
  timezone: z.string().min(1, 'Timezone is required'),
  channel_preferences: z.object({
    push_enabled: z.boolean(),
    email_enabled: z.boolean(),
  }),
});

type PreferenceFormData = z.infer<typeof preferenceSchema>;

const DIGEST_FREQUENCIES = [
  { label: 'Immediate', value: 'immediate' },
  { label: 'Hourly', value: 'hourly' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Never', value: 'never' },
] as const;

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Dubai',
  'Asia/Singapore',
  'Australia/Sydney',
] as const;

const DEFAULT_VALUES: PreferenceFormData = {
  digest_enabled: true,
  digest_frequency: 'daily',
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
  timezone: 'UTC',
  channel_preferences: {
    push_enabled: true,
    email_enabled: true,
  },
};

function mapPrefsToFormData(prefs: NotificationPreference): PreferenceFormData {
  return {
    digest_enabled: prefs.digest_enabled,
    digest_frequency: prefs.digest_frequency,
    quiet_hours_enabled: prefs.quiet_hours_enabled,
    quiet_hours_start: prefs.quiet_hours_start ?? '22:00',
    quiet_hours_end: prefs.quiet_hours_end ?? '07:00',
    timezone: prefs.timezone,
    channel_preferences: {
      push_enabled: prefs.channel_preferences?.push_enabled ?? true,
      email_enabled: prefs.channel_preferences?.email_enabled ?? true,
    },
  };
}

interface NotificationPreferencesProps {
  className?: string;
}

interface PickerProps {
  label: string;
  value: string;
  options: readonly { label: string; value: string }[];
  onSelect: (value: string) => void;
}

function InlinePicker({ label, value, options, onSelect }: PickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  return (
    <View>
      <Text className="mb-1 text-sm font-medium text-muted-foreground">{label}</Text>
      <Pressable
        onPress={() => setIsOpen(!isOpen)}
        className="flex-row items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
      >
        <Text className="text-base text-foreground">{selectedLabel}</Text>
        <ChevronDown color="#64748b" size={18} />
      </Pressable>
      {isOpen && (
        <View className="mt-1 rounded-lg border border-border bg-card">
          {options.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => {
                onSelect(option.value);
                setIsOpen(false);
              }}
              className={cn(
                'px-4 py-3 border-b border-border',
                option.value === value && 'bg-primary/10',
              )}
            >
              <Text
                className={cn(
                  'text-base',
                  option.value === value ? 'font-semibold text-primary' : 'text-foreground',
                )}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export function NotificationPreferences({ className }: NotificationPreferencesProps) {
  const { preferences, updatePreferences } = useNotifications();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<PreferenceFormData>({
    resolver: zodResolver(preferenceSchema),
    defaultValues: DEFAULT_VALUES,
  });

  // Load preferences on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const prefs = await getNotificationPreferences();
        if (!cancelled) {
          form.reset(mapPrefsToFormData(prefs));
        }
      } catch {
        if (!cancelled) {
          // Fall back to store preferences if API call fails
          if (preferences) {
            form.reset(mapPrefsToFormData(preferences));
          }
          setError('Failed to load preferences. Using cached values.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced auto-save on form value changes
  const savePreferences = useCallback(
    async (data: PreferenceFormData) => {
      try {
        setIsSaving(true);
        setError(null);
        await updatePreferences({
          digest_enabled: data.digest_enabled,
          digest_frequency: data.digest_frequency,
          quiet_hours_enabled: data.quiet_hours_enabled,
          quiet_hours_start: data.quiet_hours_start,
          quiet_hours_end: data.quiet_hours_end,
          timezone: data.timezone,
          channel_preferences: {
            push_enabled: data.channel_preferences.push_enabled,
            email_enabled: data.channel_preferences.email_enabled,
          },
        });
      } catch {
        setError('Failed to save preferences. Please try again.');
      } finally {
        setIsSaving(false);
      }
    },
    [updatePreferences],
  );

  useEffect(() => {
    const subscription = form.watch((values) => {
      if (isLoading) return;

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        const parsed = preferenceSchema.safeParse(values);
        if (parsed.success) {
          void savePreferences(parsed.data);
        }
      }, 800);
    });

    return () => {
      subscription.unsubscribe();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [form, isLoading, savePreferences]);

  const quietHoursEnabled = form.watch('quiet_hours_enabled');
  const digestEnabled = form.watch('digest_enabled');

  if (isLoading) {
    return (
      <View className={cn('gap-4 p-4', className)}>
        <LoadingSkeleton height={24} width="50%" />
        <LoadingSkeleton height={56} />
        <LoadingSkeleton height={56} />
        <LoadingSkeleton height={24} width="40%" />
        <LoadingSkeleton height={56} />
        <LoadingSkeleton height={56} />
        <LoadingSkeleton height={56} />
      </View>
    );
  }

  return (
    <ScrollView className={cn('flex-1', className)} contentContainerClassName="p-4 gap-6 pb-12">
      {/* Status bar */}
      {(isSaving || error) && (
        <View className="flex-row items-center gap-2">
          {isSaving && (
            <>
              <ActivityIndicator size="small" color="#6366f1" />
              <Text className="text-sm text-muted-foreground">Saving...</Text>
            </>
          )}
          {error && (
            <Text className="text-sm text-destructive">{error}</Text>
          )}
        </View>
      )}

      {/* Push & Email Notifications */}
      <View>
        <Text className="mb-3 text-base font-semibold text-foreground">Notifications</Text>
        <Card className="gap-0 p-0">
          <Controller
            name="channel_preferences.push_enabled"
            control={form.control}
            render={({ field: { onChange, value } }) => (
              <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
                <View className="flex-row items-center gap-3 flex-1">
                  <Bell color="#6366f1" size={20} />
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">Push Notifications</Text>
                    <Text className="text-xs text-muted-foreground">Receive alerts on this device</Text>
                  </View>
                </View>
                <Switch
                  value={value}
                  onValueChange={onChange}
                  trackColor={{ false: '#d1d5db', true: '#818cf8' }}
                  thumbColor={value ? '#6366f1' : '#f3f4f6'}
                  accessibilityLabel="Push Notifications"
                  testID="push-toggle"
                />
              </View>
            )}
          />
          <Controller
            name="channel_preferences.email_enabled"
            control={form.control}
            render={({ field: { onChange, value } }) => (
              <View className="flex-row items-center justify-between px-4 py-3">
                <View className="flex-row items-center gap-3 flex-1">
                  <Mail color="#6366f1" size={20} />
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">Email Notifications</Text>
                    <Text className="text-xs text-muted-foreground">Receive notifications via email</Text>
                  </View>
                </View>
                <Switch
                  value={value}
                  onValueChange={onChange}
                  trackColor={{ false: '#d1d5db', true: '#818cf8' }}
                  thumbColor={value ? '#6366f1' : '#f3f4f6'}
                  accessibilityLabel="Email Notifications"
                  testID="email-toggle"
                />
              </View>
            )}
          />
        </Card>
      </View>

      {/* Quiet Hours */}
      <View>
        <Text className="mb-3 text-base font-semibold text-foreground">Quiet Hours</Text>
        <Card className="gap-0 p-0">
          <Controller
            name="quiet_hours_enabled"
            control={form.control}
            render={({ field: { onChange, value } }) => (
              <View
                className={cn(
                  'flex-row items-center justify-between px-4 py-3',
                  quietHoursEnabled && 'border-b border-border',
                )}
              >
                <View className="flex-row items-center gap-3 flex-1">
                  <BellOff color="#6366f1" size={20} />
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">Enable Quiet Hours</Text>
                    <Text className="text-xs text-muted-foreground">
                      Silence notifications during set hours
                    </Text>
                  </View>
                </View>
                <Switch
                  value={value}
                  onValueChange={onChange}
                  trackColor={{ false: '#d1d5db', true: '#818cf8' }}
                  thumbColor={value ? '#6366f1' : '#f3f4f6'}
                  accessibilityLabel="Enable Quiet Hours"
                  testID="quiet-hours-toggle"
                />
              </View>
            )}
          />
          {quietHoursEnabled && (
            <View className="px-4 py-3 gap-3">
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Controller
                    name="quiet_hours_start"
                    control={form.control}
                    render={({ field: { onChange, value }, fieldState: { error: fieldError } }) => (
                      <View>
                        <View className="flex-row items-center gap-2 mb-1">
                          <Clock color="#64748b" size={14} />
                          <Text className="text-sm font-medium text-muted-foreground">Start Time</Text>
                        </View>
                        <Input
                          placeholder="22:00"
                          value={value ?? ''}
                          onChangeText={onChange}
                          testID="quiet-start-input"
                          keyboardType="numbers-and-punctuation"
                        />
                        {fieldError && (
                          <Text className="mt-1 text-xs text-destructive">{fieldError.message}</Text>
                        )}
                      </View>
                    )}
                  />
                </View>
                <View className="flex-1">
                  <Controller
                    name="quiet_hours_end"
                    control={form.control}
                    render={({ field: { onChange, value }, fieldState: { error: fieldError } }) => (
                      <View>
                        <View className="flex-row items-center gap-2 mb-1">
                          <Clock color="#64748b" size={14} />
                          <Text className="text-sm font-medium text-muted-foreground">End Time</Text>
                        </View>
                        <Input
                          placeholder="07:00"
                          value={value ?? ''}
                          onChangeText={onChange}
                          testID="quiet-end-input"
                          keyboardType="numbers-and-punctuation"
                        />
                        {fieldError && (
                          <Text className="mt-1 text-xs text-destructive">{fieldError.message}</Text>
                        )}
                      </View>
                    )}
                  />
                </View>
              </View>
              <Controller
                name="timezone"
                control={form.control}
                render={({ field: { onChange, value } }) => (
                  <View>
                    <View className="flex-row items-center gap-2 mb-1">
                      <Globe color="#64748b" size={14} />
                      <Text className="text-sm font-medium text-muted-foreground">Timezone</Text>
                    </View>
                    <InlinePicker
                      label=""
                      value={value}
                      options={TIMEZONES.map((tz) => ({ label: tz.replace(/_/g, ' '), value: tz }))}
                      onSelect={onChange}
                    />
                  </View>
                )}
              />
            </View>
          )}
        </Card>
      </View>

      {/* Digest Preferences */}
      <View>
        <Text className="mb-3 text-base font-semibold text-foreground">Email Digest</Text>
        <Card className="gap-0 p-0">
          <Controller
            name="digest_enabled"
            control={form.control}
            render={({ field: { onChange, value } }) => (
              <View
                className={cn(
                  'flex-row items-center justify-between px-4 py-3',
                  digestEnabled && 'border-b border-border',
                )}
              >
                <View className="flex-row items-center gap-3 flex-1">
                  <Mail color="#6366f1" size={20} />
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">Email Digest</Text>
                    <Text className="text-xs text-muted-foreground">
                      Receive a summary of notifications
                    </Text>
                  </View>
                </View>
                <Switch
                  value={value}
                  onValueChange={onChange}
                  trackColor={{ false: '#d1d5db', true: '#818cf8' }}
                  thumbColor={value ? '#6366f1' : '#f3f4f6'}
                  accessibilityLabel="Enable Email Digest"
                  testID="digest-toggle"
                />
              </View>
            )}
          />
          {digestEnabled && (
            <View className="px-4 py-3">
              <Controller
                name="digest_frequency"
                control={form.control}
                render={({ field: { onChange, value } }) => (
                  <InlinePicker
                    label="Frequency"
                    value={value}
                    options={DIGEST_FREQUENCIES.map((f) => ({ label: f.label, value: f.value }))}
                    onSelect={onChange}
                  />
                )}
              />
            </View>
          )}
        </Card>
      </View>
    </ScrollView>
  );
}
