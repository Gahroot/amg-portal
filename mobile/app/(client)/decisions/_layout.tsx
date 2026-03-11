import { Stack } from 'expo-router';

export default function DecisionsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#f8fafc',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Decisions' }} />
      <Stack.Screen name="[id]" options={{ title: 'Decision Detail' }} />
    </Stack>
  );
}
