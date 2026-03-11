import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function InternalProgramsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-2xl font-bold text-foreground">Programs</Text>
        <Text className="mt-2 text-muted-foreground">All programs across clients.</Text>
      </View>
    </SafeAreaView>
  );
}
