import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function InternalClientsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-2xl font-bold text-foreground">Clients</Text>
        <Text className="mt-2 text-muted-foreground">Manage client profiles and onboarding.</Text>
      </View>
    </SafeAreaView>
  );
}
