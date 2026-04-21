import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NotificationPreferences } from '@/components/notifications';

export default function NotificationsSettingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <NotificationPreferences />
      </ScrollView>
    </SafeAreaView>
  );
}
