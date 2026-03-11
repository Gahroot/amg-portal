import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function InternalDashboardScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-2xl font-bold text-foreground">Dashboard</Text>
        <Text className="mt-2 text-muted-foreground">Overview of programs, clients, and escalations.</Text>
      </View>
    </SafeAreaView>
  );
}
