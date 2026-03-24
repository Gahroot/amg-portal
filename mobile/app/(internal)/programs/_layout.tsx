import { Stack } from 'expo-router';

export default function ProgramsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#f8fafc',
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Programs' }} />
      <Stack.Screen name="[id]" options={{ title: 'Program Detail' }} />
    </Stack>
  );
}
