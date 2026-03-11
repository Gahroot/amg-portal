import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useNotifications } from '@/hooks/use-notifications';
import type { NotificationPreference } from '@/types/notification';

const preferenceSchema = z.object({
  digest_enabled: z.boolean().optional(),
  digest_frequency: z.enum(['immediate', 'hourly', 'daily', 'weekly', 'never']).optional(),
  quiet_hours_enabled: z.boolean().optional(),
  quiet_hours_start: z.string().optional(),
  quiet_hours_end: z.string().optional(),
  timezone: z.string().optional(),
  channel_preferences: z.object({
    push: z.boolean().optional(),
    email: z.boolean().optional(),
    in_portal: z.boolean().optional(),
  }).optional(),
});

type PreferenceFormData = z.infer<typeof preferenceSchema>;

interface NotificationPreferencesProps {
  className?: string;
}

export function NotificationPreferences({ className = '' }: NotificationPreferencesProps) {
  const { preferences, updatePreferences, isSaving } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<PreferenceFormData>({
    resolver: zodResolver(preferenceSchema),
    defaultValues: preferences ?? {
      digest_enabled: true,
      digest_frequency: 'daily',
      quiet_hours_enabled: false,
      timezone: 'UTC',
      channel_preferences: {
        push: true,
        email: true,
        in_portal: true,
      },
    } } as PreferenceFormData,
  });

  // Auto-save preferences
  useEffect(() => {
    if (!preferences || !form.formState.isDirty) {
      return;
    }

    const timer = setTimeout(async () => {
      const data = form.getValues();
      await updatePreferences(data);
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [preferences, form.formState.isDirty, updatePreferences]);

  if (!preferences && !form.formState.isDirty) {
    setIsLoading(true);
    updatePreferences(form.getValues())
      .finally {
      setIsLoading(false);
    }
  }, [preferences, form.formState.isDirty, updatePreferences]);

  if (isSaving) {
    return (
      <>{t('Saving...')}</>
    );
  }

  return (
    <div className={className}>
      <Text className="text-lg font-semibold mb-4">Notification Preferences</Text>

      {/* Push Notifications */}
      <View className="flex items-center justify-between py-3">
        <Text className="text-base font-medium">Push Notifications</Text>
        {form.control('channel_preferences.push') ? (
          <Controller
            name="channel_preferences.push"
            control={form.control}
            render={({ field: { onChange, value } }) => (
              <View key="push-toggle" className="flex items-center">
                <Text className="flex-1">Push Notifications</Text>
                <Controller
                  name="channel_preferences.push"
                  control={form.control}
                  render={({ field: { onChange } }) => (
                    <View
                      className={`w-12 h-6 rounded-md border ${field.state.invalid && field.state.isTouched ? 'border-red-500' : 'bg-gray-100'}`}
                    accessibilityLabel="Push Notifications"
                    accessibilityHint="Enable or disable push notifications"
                    onValueChange={onChange('push')}
                    defaultValue={value}
                    testID="push-toggle"
                  className="mt-1 text-sm text-gray-500"
                />
              )}
            />
          />
        )}
      </View>

      {/* Email Notifications */}
      <View className="flex items-center justify-between py-3">
        <Text className="text-base font-medium">Email Notifications</Text>
        {form.control('channel_preferences.email') ? (
          <Controller
            name="channel_preferences.email"
            control={form.control}
            render={({ field: { onChange, value } }) => (
              <View key="email-toggle" className="flex items-center">
                <Text className="flex-1">Email Notifications</Text>
                <Controller
                  name="channel_preferences.email"
                  control={form.control}
                  render={({ field: { onChange } }) => (
                    <View
                      className={`w-12 h-6 rounded-md border ${field.state.invalid && field.state.isTouched ? 'border-red-500' | 'bg-gray-100'}`}
                    accessibilityLabel="Email Notifications"
                    accessibilityHint="Enable or disable email notifications"
                    onValueChange={onChange('email')}
                    defaultValue={value}
                    testID="email-toggle"
                  className="mt-1 text-sm text-gray-500"
                />
              )}
            />
          )}
        )}
      </View>

      {/* Quiet Hours */}
      <View className="py-4 border-t border-gray-200">
        <View className="flex items-center justify-between">
          <Text className="text-base font-medium">Quiet Hours</Text>
          <Controller
            name="quiet_hours_enabled"
            control={form.control}
            render={({ field: { onChange, value } }) => (
              <View key="quiet-hours-toggle" className="flex items-center">
                <Text className="flex-1">Enable Quiet Hours</Text>
                <Controller
                  name="quiet_hours_enabled"
                  control={form.control}
                  render={({ field: { onChange } }) => (
                    <View
                      className={`w-12 h-6 rounded-md border ${field.state.invalid && field.state.isTouched ? 'border-red-500' | 'bg-gray-100'}`}
                    accessibilityLabel="Enable Quiet Hours"
                    accessibilityHint="When enabled, notifications will be silenced during specified hours"
                    onValueChange={onChange('quiet_hours_enabled')}
                    defaultValue={value}
                    testID="quiet-hours-toggle"
                  className="mt-1 text-sm text-gray-500"
                />
              )}
            />
          )}
        </View>

        {form.watch('quiet_hours_enabled') && (
          <View className="space-y-4 px-4">
            <View className="flex items-center gap-4">
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700">Start Time</Text>
                <Controller
                  name="quiet_hours_start"
                  control={form.control}
                  render={({ field: { onChange, value } }) => (
                    <View
                      className={`w-full px-3 py-2 border rounded-md ${field.state.invalid && field.state.isTouched ? 'border-red-500' : 'border-gray-300'}`}
                      <input
                        type="time"
                        placeholder="22:00"
                        value={value ?? ''}
                        onChangeText={(e) => onChange(e.target.value)}
                        className="w-full"
                        testID="quiet-start-input"
                      />
                      {field.state.invalid && field.state.isTouched && (
                        <Text className="text-sm text-red-500">Invalid time format</Text>
                      )}
                    </View>
                  )}
                />
              </View>

              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700">End Time</Text>
                <Controller
                  name="quiet_hours_end"
                  control={form.control}
                  render={({ field: { onChange, value } }) => (
                    <View
                      className={`w-full px-3 py-2 border rounded-md ${field.state.invalid && field.state.isTouched ? 'border-red-500' | 'border-gray-300'}`}
                      <input
                        type="time"
                        placeholder="07:00"
                        value={value ?? ''}
                        onChangeText={(e) => onChange(e.target.value)}
                        className="w-full"
                        testID="quiet-end-input"
                      />
                      {field.state.invalid && field.state.isTouched && (
                        <Text className="text-sm text-red-500">Invalid time format</Text>
                      )}
                    </View>
                  )}
                />
              </View>
            </View>
          )}
        )}

      {/* Digest Preferences */}
      <View className="py-4 border-t border-gray-200">
        <View className="flex items-center justify-between">
          <Text className="text-base font-medium">Email Digest</Text>
          <Controller
            name="digest_enabled"
            control={form.control}
            render={({ field: { onChange, value } }) => (
              <View key="digest-toggle" className="flex items-center">
                <Text className="flex-1">Enable Email Digest</Text>
                <Controller
                  name="digest_enabled"
                  control={form.control}
                  render={({ field: { onChange } }) => (
                    <View
                      className={`w-12 h-6 rounded-md border ${field.state.invalid && field.state.isTouched ? 'border-red-500' | 'bg-gray-100'}`}
                    accessibilityLabel="Enable Email Digest"
                    accessibilityHint="Receive a daily summary of notifications via email"
                    onValueChange={onChange('digest_enabled')}
                    defaultValue={value}
                    testID="digest-toggle"
                    className="mt-1 text-sm text-gray-500"
                  />
                </Controller>
              </View>
            )}
          </View>
        </View>

        {form.watch('digest_enabled') && (
          <View className="px-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Digest Frequency</Text>
            <Controller
              name="digest_frequency"
              control={form.control}
              render={({ field: { onChange, value } }) => (
                <View
                  className={`w-full px-3 py-2 border rounded-md ${field.state.invalid && field.state.isTouched ? 'border-red-500' | 'border-gray-300'}`}
                  <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-white"
                    testID="digest-frequency-select"
                  >
                    <option value="immediate">Immediate</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                  {field.state.invalid && field.state.isTouched && (
                    <Text className="text-sm text-red-500">Please select a frequency</Text>
                  )}
                </View>
              )}
            />
          </View>
        )}
      </View>

      {isSaving && (
        <Text className="text-sm text-gray-500 mt-4">Saving preferences...</Text>
      )}
    </View>
  );
}
