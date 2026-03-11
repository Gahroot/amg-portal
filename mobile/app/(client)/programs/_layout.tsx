import { Stack } from 'expo-router';

export default function ProgramsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#f8fafc',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Programs' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Program Detail' }} />
      <Stack.Screen name="[id]/summary" options={{ title: 'Program Summary' }} />
      <Stack.Screen
        name="[id]/milestone/[milestoneId]"
        options={{ title: 'Milestone' }}
      />
    </Stack>
  );
}
