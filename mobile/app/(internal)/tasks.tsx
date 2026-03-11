import { useState, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Clock, AlertCircle, CheckCircle2, Circle, Kanban } from 'lucide-react-native';

import { listPrograms } from '@/lib/api/programs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingList } from '@/components/layout/loading-skeleton';
import type { Task, TaskStatus, TaskPriority } from '@/types/program';
import { format, isPast, parseISO } from 'date-fns';

const TASK_COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'todo', label: 'To Do', color: '#64748b' },
  { status: 'in_progress', label: 'In Progress', color: '#3b82f6' },
  { status: 'blocked', label: 'Blocked', color: '#ef4444' },
  { status: 'done', label: 'Done', color: '#22c55e' },
];

const PRIORITY_STYLES: Record<TaskPriority, { bg: string; text: string }> = {
  low: { bg: 'bg-slate-100', text: 'text-slate-600' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-600' },
  high: { bg: 'bg-orange-100', text: 'text-orange-600' },
  urgent: { bg: 'bg-red-100', text: 'text-red-600' },
};

const STATUS_ICONS: Record<TaskStatus, typeof Circle> = {
  todo: Circle,
  in_progress: Clock,
  blocked: AlertCircle,
  done: CheckCircle2,
  cancelled: Circle,
};

function TaskCard({ task }: { task: Task }) {
  const StatusIcon = STATUS_ICONS[task.status];
  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && task.status !== 'done';
  
  return (
    <Card className="mb-2">
      <View className="flex-row items-start gap-2">
        <StatusIcon
          size={16}
          color={
            task.status === 'done' ? '#22c55e' : task.status === 'blocked' ? '#ef4444' : '#64748b'
          }
        />
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground" numberOfLines={2}>
            {task.title}
          </Text>
          {task.description && (
            <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={2}>
              {task.description}
            </Text>
          )}
          <View className="mt-2 flex-row items-center gap-2">
            <View className={PRIORITY_STYLES[task.priority].bg + ' rounded-full px-2 py-0.5'}>
              <Text className={`text-xs font-medium ${PRIORITY_STYLES[task.priority].text}`}>
                {task.priority}
              </Text>
            </View>
            {task.due_date && (
              <View className="flex-row items-center gap-1">
                <Clock color={isOverdue ? '#ef4444' : '#94a3b8'} size={12} />
                <Text className={`text-xs ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {format(parseISO(task.due_date), 'MMM d')}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Card>
  );
}

function KanbanColumn({
  status,
  label,
  color,
  tasks,
}: {
  status: TaskStatus;
  label: string;
  color: string;
  tasks: Task[];
}) {
  return (
    <View className="mr-3 w-72">
      {/* Column Header */}
      <View className="mb-2 flex-row items-center justify-between rounded-lg bg-card px-3 py-2">
        <View className="flex-row items-center gap-2">
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <Text className="text-sm font-semibold text-foreground">{label}</Text>
        </View>
        <View className="rounded-full bg-secondary px-2 py-0.5">
          <Text className="text-xs font-medium text-muted-foreground">{tasks.length}</Text>
        </View>
      </View>

      {/* Task Cards */}
      <ScrollView className="max-h-[70vh]" showsVerticalScrollIndicator={false}>
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <View className="items-center justify-center rounded-lg border border-dashed border-border py-8">
            <Text className="text-sm text-muted-foreground">No tasks</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

export default function InternalTasksScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data: programsData, isLoading: programsLoading, refetch } = useQuery({
    queryKey: ['programs'],
    queryFn: () => listPrograms({ status: 'active', limit: 100 }),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Get tasks from all active programs or selected program
  const allTasks = useMemo(() => {
    // In a real app, we'd fetch tasks per program or have a dedicated endpoint
    // For now, we'll show mock data based on the program structure
    const mockTasks: Task[] = [];
    
    // Generate some sample tasks for demonstration
    const sampleTasks: Omit<Task, 'id' | 'milestone_id' | 'created_at' | 'updated_at'>[] = [
      { title: 'Complete client intake form', description: 'Gather all required client information', status: 'todo', priority: 'high', due_date: new Date().toISOString(), assigned_to: null },
      { title: 'Review compliance documents', description: 'Check KYC/AML documentation', status: 'in_progress', priority: 'urgent', due_date: new Date(Date.now() + 86400000).toISOString(), assigned_to: null },
      { title: 'Schedule kickoff meeting', description: 'Arrange initial meeting with stakeholders', status: 'todo', priority: 'medium', due_date: null, assigned_to: null },
      { title: 'Prepare program proposal', description: 'Draft initial program scope and objectives', status: 'in_progress', priority: 'high', due_date: new Date(Date.now() + 172800000).toISOString(), assigned_to: null },
      { title: 'Await partner response', description: 'Waiting for vendor availability', status: 'blocked', priority: 'medium', due_date: null, assigned_to: null },
      { title: 'Finalize budget approval', description: 'Get sign-off from finance team', status: 'done', priority: 'high', due_date: new Date(Date.now() - 86400000).toISOString(), assigned_to: null },
      { title: 'Setup communication channels', description: 'Create Slack channel and email group', status: 'done', priority: 'low', due_date: null, assigned_to: null },
      { title: 'Blocked on legal review', description: 'Contract review pending from legal team', status: 'blocked', priority: 'urgent', due_date: new Date(Date.now() + 259200000).toISOString(), assigned_to: null },
      { title: 'Research venue options', description: 'Compile list of suitable venues', status: 'todo', priority: 'medium', due_date: new Date(Date.now() + 432000000).toISOString(), assigned_to: null },
      { title: 'Draft itinerary outline', description: 'Create preliminary schedule', status: 'in_progress', priority: 'high', due_date: new Date(Date.now() + 345600000).toISOString(), assigned_to: null },
    ];

    sampleTasks.forEach((task, index) => {
      mockTasks.push({
        ...task,
        id: `task-${index}`,
        milestone_id: `milestone-${index % 3}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    return mockTasks;
  }, []);

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      blocked: [],
      done: [],
      cancelled: [],
    };

    allTasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });

    return grouped;
  }, [allTasks]);

  // Stats
  const stats = {
    total: allTasks.length,
    todo: tasksByStatus.todo.length,
    inProgress: tasksByStatus.in_progress.length,
    blocked: tasksByStatus.blocked.length,
    done: tasksByStatus.done.length,
  };

  if (programsLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <View className="p-4">
          <LoadingList count={3} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      {/* Header with Stats */}
      <View className="border-b border-border p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-foreground">Task Board</Text>
          <View className="flex-row items-center gap-2">
            <Kanban color="#64748b" size={20} />
            <Text className="text-sm text-muted-foreground">Kanban View</Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View className="flex-row gap-2">
          <View className="flex-1 rounded-lg bg-card p-2.5">
            <Text className="text-lg font-bold text-slate-600">{stats.todo}</Text>
            <Text className="text-xs text-muted-foreground">To Do</Text>
          </View>
          <View className="flex-1 rounded-lg bg-card p-2.5">
            <Text className="text-lg font-bold text-blue-600">{stats.inProgress}</Text>
            <Text className="text-xs text-muted-foreground">In Progress</Text>
          </View>
          <View className="flex-1 rounded-lg bg-card p-2.5">
            <Text className="text-lg font-bold text-red-600">{stats.blocked}</Text>
            <Text className="text-xs text-muted-foreground">Blocked</Text>
          </View>
          <View className="flex-1 rounded-lg bg-card p-2.5">
            <Text className="text-lg font-bold text-green-600">{stats.done}</Text>
            <Text className="text-xs text-muted-foreground">Done</Text>
          </View>
        </View>
      </View>

      {/* Kanban Board */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="p-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {TASK_COLUMNS.map((column) => (
          <KanbanColumn
            key={column.status}
            status={column.status}
            label={column.label}
            color={column.color}
            tasks={tasksByStatus[column.status]}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
