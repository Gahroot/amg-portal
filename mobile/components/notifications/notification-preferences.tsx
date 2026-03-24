import { useEffect } from 'react';
import { View, Text, Switch, ActivityIndicator } from 'react-native';

import { useNotifications } from '@/hooks/use-notifications';

export function NotificationPreferences() {
  const { preferences, updatePreferences } = useNotifications();

  const toggleDigest = async (value: boolean) => {
    await updatePreferences({ digest_enabled: value });
  };

  const toggleChannel = async (channel: string, value: boolean) => {
    await updatePreferences({
      channel_preferences: { ...(preferences?.channel_preferences ?? {}), [channel]: value },
    });
  };

  if (!preferences) {
    return (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <ActivityIndicator size="small" color="#eab308" />
      </View>
    );
  }

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 16, fontWeight: '600', color: '#f8fafc', marginBottom: 12 }}>
        Notification Preferences
      </Text>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#1e293b',
        }}
      >
        <View>
          <Text style={{ fontSize: 14, color: '#f8fafc' }}>Email Digest</Text>
          <Text style={{ fontSize: 12, color: '#64748b' }}>Receive summary emails</Text>
        </View>
        <Switch
          value={preferences.digest_enabled}
          onValueChange={toggleDigest}
          trackColor={{ false: '#334155', true: '#eab308' }}
          thumbColor="#f8fafc"
        />
      </View>

      {(['push', 'email', 'in_portal'] as const).map((channel) => (
        <View
          key={channel}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#1e293b',
          }}
        >
          <Text style={{ fontSize: 14, color: '#f8fafc', textTransform: 'capitalize' }}>
            {channel.replace('_', ' ')} notifications
          </Text>
          <Switch
            value={(preferences.channel_preferences?.[channel] as boolean) ?? true}
            onValueChange={(val) => toggleChannel(channel, val)}
            trackColor={{ false: '#334155', true: '#eab308' }}
            thumbColor="#f8fafc"
          />
        </View>
      ))}
    </View>
  );
}
