import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle, Clock, AlertCircle, Calendar, ArrowLeft } from 'lucide-react-native';
import { format } from 'date-fns';

import { useProgram } from '@/hooks/use-client-programs';
import { LoadingSkeleton } from '@/components/layout/loading-skeleton';
import { cn } from '@/lib/utils';
import type { MilestoneStatus, TaskStatus } from '@/types/program';

const STATUS_CONFIG: Record<MilestoneStatus, { icon: typeof CheckCircle; color: string; label: string }> = {
  completed: { icon: CheckCircle, color: '#22c55e', label: 'Completed' },
  in_progress: { icon: Clock, color: '#eab308', label: 'In Progress' },
  pending: { icon: Clock, color: '#94a3b8', label: 'Pending' },
  cancelled: { icon: AlertCircle, color: '#64748b', label: 'Cancelled' },
};

const TASK_STATUS_STYLE: Record<TaskStatus, string> = {
  done: 'bg-green-100 text-green-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  todo: 'bg-gray-100 text-gray-600',
  blocked: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function MilestoneDetailScreen() {
  const { id, milestoneId } = useLocalSearchParams<{ id: string; milestoneId: string }>();
  const router = useRouter();
  const { data: program, isLoading } = useProgram(id ?? '');

  const milestone = program?.milestones.find((m) => m.id === milestoneId);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <View className="p-4">
          <LoadingSkeleton height={28} width="60%" className="mb-3" />
          <LoadingSkeleton height={16} width="40%" className="mb-4" />
          <LoadingSkeleton height={80} className="mb-3" />
        </View>
      </SafeAreaView>
    );
  }

  if (!milestone) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['bottom']}>
        <Text className="text-lg text-muted-foreground">Milestone not found</Text>
        <Pressable onPress={() => router.back()} className="mt-4 rounded-lg bg-accent px-4 py-2">
          <Text className="text-sm font-semibold text-accent-foreground">Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const config = STATUS_CONFIG[milestone.status];
  const StatusIcon = config.icon;
  const completedTasks = milestone.tasks.filter((t) => t.status === 'done').length;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-2xl font-bold text-foreground">{milestone.title}</Text>
          <View className="mt-2 flex-row items-center">
            <StatusIcon color={config.color} size={18} />
            <Text className={cn('ml-1.5 text-sm font-medium')} style={{ color: config.color }}>
              {config.label}
            </Text>
          </View>
        </View>

        {/* Info Cards */}
        <View className="px-4 mt-2">
          {milestone.description ? (
            <View className="rounded-xl border border-border bg-card p-4 mb-3">
              <Text className="text-xs font-medium text-muted-foreground mb-1">Description</Text>
              <Text className="text-sm text-foreground">{milestone.description}</Text>
            </View>
          ) : null}

          <View className="flex-row gap-3 mb-3">
            {milestone.due_date ? (
              <View className="flex-1 rounded-xl border border-border bg-card p-4">
                <View className="flex-row items-center mb-1">
                  <Calendar color="#64748b" size={14} />
                  <Text className="ml-1.5 text-xs font-medium text-muted-foreground">Due Date</Text>
                </View>
                <Text className="text-sm font-medium text-foreground">
                  {format(new Date(milestone.due_date), 'MMM d, yyyy')}
                </Text>
              </View>
            ) : null}
            <View className="flex-1 rounded-xl border border-border bg-card p-4">
              <Text className="text-xs font-medium text-muted-foreground mb-1">Progress</Text>
              <Text className="text-sm font-medium text-foreground">
                {completedTasks}/{milestone.tasks.length} tasks complete
              </Text>
            </View>
          </View>

          {/* Tasks (client-visible deliverables) */}
          {milestone.tasks.length > 0 ? (
            <View className="rounded-xl border border-border bg-card overflow-hidden">
              <View className="px-4 py-3 border-b border-border">
                <Text className="text-base font-semibold text-foreground">Deliverables</Text>
              </View>
              {milestone.tasks
                .filter((t) => t.status === 'done')
                .map((task) => (
                  <View key={task.id} className="px-4 py-3 border-b border-border flex-row items-center">
                    <CheckCircle color="#22c55e" size={16} />
                    <View className="ml-3 flex-1">
                      <Text className="text-sm font-medium text-foreground">{task.title}</Text>
                      {task.due_date ? (
                        <Text className="text-xs text-muted-foreground">
                          {format(new Date(task.due_date), 'MMM d, yyyy')}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              {milestone.tasks.filter((t) => t.status === 'done').length === 0 ? (
                <View className="px-4 py-3">
                  <Text className="text-sm text-muted-foreground">
                    No completed deliverables yet.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Back to Program */}
        <View className="px-4 mt-6">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center justify-center rounded-lg bg-muted py-3"
          >
            <ArrowLeft color="#64748b" size={18} />
            <Text className="ml-2 text-sm font-medium text-muted-foreground">Back to Program</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
