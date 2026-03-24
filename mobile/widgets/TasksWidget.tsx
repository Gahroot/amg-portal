/**
 * TasksWidget - iOS Home Screen Widget for AMG Portal
 *
 * Displays pending approvals count and tasks due today.
 * Supports multiple widget families: systemSmall, systemMedium, systemLarge,
 * and lock screen accessories (accessoryCircular, accessoryRectangular).
 *
 * Note: This widget uses expo-widgets which is currently in alpha.
 * Requires iOS development build (not available in Expo Go).
 */

import { Text, VStack, HStack, ZStack } from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  padding,
  background,
  cornerRadius,
  containerRelativeFrame,
} from '@expo/ui/swift-ui/modifiers';
import {
  createWidget,
  type WidgetFamily,
  type WidgetEnvironment,
  type WidgetTimelineEntry,
} from 'expo-widgets';

/**
 * Widget data props - updated from the main app
 */
export type TasksWidgetProps = {
  /** Number of pending approvals awaiting user action */
  pendingApprovals: number;
  /** Number of tasks due today */
  dueToday: number;
  /** Number of blocked tasks requiring attention */
  blockedTasks: number;
  /** Total active programs count */
  activePrograms: number;
  /** ISO timestamp of last update */
  lastUpdated: string;
  /** User's first name for personalization */
  userName?: string;
};

/**
 * Color scheme for the widget
 */
const COLORS = {
  primary: '#eab308', // amber/yellow
  background: '#0f172a', // slate-900
  cardBackground: '#1e293b', // slate-800
  text: '#f8fafc', // slate-50
  mutedText: '#94a3b8', // slate-400
  success: '#22c55e', // green-500
  warning: '#f59e0b', // amber-500
  danger: '#ef4444', // red-500
  info: '#3b82f6', // blue-500
};

/**
 * Format relative time for last updated display
 */
function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return '';
  }
}

/**
 * Small widget layout - Compact view with counts
 */
function SmallWidget(props: TasksWidgetProps) {
  return (
    <ZStack
      modifiers={[
        background(COLORS.background),
        cornerRadius(20),
        padding({ all: 16 }),
      ]}
    >
      <VStack
        alignment="leading"
        modifiers={[containerRelativeFrame({ axes: 'both' })]}
      >
        {/* Header */}
        <HStack>
          <Text
            modifiers={[
              font({ weight: 'bold', size: 11 }),
              foregroundStyle(COLORS.primary),
            ]}
          >
            AMG
          </Text>
        </HStack>

        {/* Main Stats */}
        <VStack alignment="leading" modifiers={[padding({ top: 8 })]}>
          {/* Pending Approvals */}
          <HStack>
            <Text modifiers={[font({ weight: 'bold', size: 28 }), foregroundStyle(COLORS.warning)]}>
              {props.pendingApprovals}
            </Text>
            <Text modifiers={[font({ size: 12 }), foregroundStyle(COLORS.mutedText), padding({ leading: 4 })]}>
              pending
            </Text>
          </HStack>

          {/* Due Today */}
          <HStack>
            <Text modifiers={[font({ weight: 'bold', size: 28 }), foregroundStyle(COLORS.danger)]}>
              {props.dueToday}
            </Text>
            <Text modifiers={[font({ size: 12 }), foregroundStyle(COLORS.mutedText), padding({ leading: 4 })]}>
              due today
            </Text>
          </HStack>
        </VStack>

        {/* Footer */}
        <HStack modifiers={[padding({ top: 4 })]}>
          <Text modifiers={[font({ size: 9 }), foregroundStyle(COLORS.mutedText)]}>
            {formatRelativeTime(props.lastUpdated)}
          </Text>
        </HStack>
      </VStack>
    </ZStack>
  );
}

/**
 * Medium widget layout - Extended view with more details
 */
function MediumWidget(props: TasksWidgetProps) {
  return (
    <ZStack
      modifiers={[
        background(COLORS.background),
        cornerRadius(20),
        padding({ all: 16 }),
      ]}
    >
      <VStack
        alignment="leading"
        modifiers={[containerRelativeFrame({ axes: 'both' })]}
      >
        {/* Header */}
        <HStack modifiers={[padding({ bottom: 8 })]}>
          <Text
            modifiers={[
              font({ weight: 'bold', size: 12 }),
              foregroundStyle(COLORS.primary),
            ]}
          >
            AMG Portal
          </Text>
          <Text modifiers={[font({ size: 10 }), foregroundStyle(COLORS.mutedText)]}>
            {formatRelativeTime(props.lastUpdated)}
          </Text>
        </HStack>

        {/* Stats Grid */}
        <HStack modifiers={[padding({ top: 12 })]}>
          {/* Pending Approvals */}
          <VStack
            alignment="leading"
            modifiers={[
              background(COLORS.cardBackground),
              cornerRadius(12),
              padding({ all: 12 }),
              containerRelativeFrame({ axes: 'horizontal' }),
            ]}
          >
            <Text modifiers={[font({ weight: 'bold', size: 24 }), foregroundStyle(COLORS.warning)]}>
              {props.pendingApprovals}
            </Text>
            <Text modifiers={[font({ size: 11 }), foregroundStyle(COLORS.mutedText)]}>
              Pending Approvals
            </Text>
          </VStack>

          {/* Due Today */}
          <VStack
            alignment="leading"
            modifiers={[
              background(COLORS.cardBackground),
              cornerRadius(12),
              padding({ all: 12 }),
              containerRelativeFrame({ axes: 'horizontal' }),
            ]}
          >
            <Text modifiers={[font({ weight: 'bold', size: 24 }), foregroundStyle(COLORS.danger)]}>
              {props.dueToday}
            </Text>
            <Text modifiers={[font({ size: 11 }), foregroundStyle(COLORS.mutedText)]}>
              Due Today
            </Text>
          </VStack>

          {/* Blocked Tasks */}
          <VStack
            alignment="leading"
            modifiers={[
              background(COLORS.cardBackground),
              cornerRadius(12),
              padding({ all: 12 }),
              containerRelativeFrame({ axes: 'horizontal' }),
            ]}
          >
            <Text modifiers={[font({ weight: 'bold', size: 24 }), foregroundStyle(COLORS.info)]}>
              {props.blockedTasks}
            </Text>
            <Text modifiers={[font({ size: 11 }), foregroundStyle(COLORS.mutedText)]}>
              Blocked
            </Text>
          </VStack>
        </HStack>

        {/* Quick Actions Hint */}
        <HStack modifiers={[padding({ top: 8 })]}>
          <Text modifiers={[font({ size: 10 }), foregroundStyle(COLORS.mutedText)]}>
            Tap to view dashboard
          </Text>
        </HStack>
      </VStack>
    </ZStack>
  );
}

/**
 * Large widget layout - Full dashboard view
 */
function LargeWidget(props: TasksWidgetProps) {
  const greeting = props.userName ? `Hi, ${props.userName}` : 'Welcome back';

  return (
    <ZStack
      modifiers={[
        background(COLORS.background),
        cornerRadius(20),
        padding({ all: 20 }),
      ]}
    >
      <VStack
        alignment="leading"
        modifiers={[containerRelativeFrame({ axes: 'both' })]}
      >
        {/* Header */}
        <HStack modifiers={[padding({ bottom: 12 })]}>
          <VStack alignment="leading">
            <Text modifiers={[font({ weight: 'bold', size: 18 }), foregroundStyle(COLORS.text)]}>
              {greeting}
            </Text>
            <Text modifiers={[font({ size: 12 }), foregroundStyle(COLORS.mutedText)]}>
              Here's your AMG overview
            </Text>
          </VStack>
          <Text modifiers={[font({ size: 10 }), foregroundStyle(COLORS.mutedText)]}>
            {formatRelativeTime(props.lastUpdated)}
          </Text>
        </HStack>

        {/* Main Stats Row */}
        <HStack modifiers={[padding({ top: 16 })]}>
          {/* Pending Approvals */}
          <VStack
            alignment="leading"
            modifiers={[
              background(COLORS.cardBackground),
              cornerRadius(12),
              padding({ all: 14 }),
              containerRelativeFrame({ axes: 'horizontal' }),
            ]}
          >
            <Text modifiers={[font({ weight: 'bold', size: 32 }), foregroundStyle(COLORS.warning)]}>
              {props.pendingApprovals}
            </Text>
            <Text modifiers={[font({ size: 12 }), foregroundStyle(COLORS.mutedText)]}>
              Pending Approvals
            </Text>
          </VStack>

          {/* Due Today */}
          <VStack
            alignment="leading"
            modifiers={[
              background(COLORS.cardBackground),
              cornerRadius(12),
              padding({ all: 14 }),
              containerRelativeFrame({ axes: 'horizontal' }),
            ]}
          >
            <Text modifiers={[font({ weight: 'bold', size: 32 }), foregroundStyle(COLORS.danger)]}>
              {props.dueToday}
            </Text>
            <Text modifiers={[font({ size: 12 }), foregroundStyle(COLORS.mutedText)]}>
              Tasks Due Today
            </Text>
          </VStack>
        </HStack>

        {/* Secondary Stats Row */}
        <HStack modifiers={[padding({ top: 12 })]}>
          {/* Blocked Tasks */}
          <VStack
            alignment="leading"
            modifiers={[
              background(COLORS.cardBackground),
              cornerRadius(12),
              padding({ all: 14 }),
              containerRelativeFrame({ axes: 'horizontal' }),
            ]}
          >
            <Text modifiers={[font({ weight: 'bold', size: 28 }), foregroundStyle(COLORS.info)]}>
              {props.blockedTasks}
            </Text>
            <Text modifiers={[font({ size: 12 }), foregroundStyle(COLORS.mutedText)]}>
              Blocked Tasks
            </Text>
          </VStack>

          {/* Active Programs */}
          <VStack
            alignment="leading"
            modifiers={[
              background(COLORS.cardBackground),
              cornerRadius(12),
              padding({ all: 14 }),
              containerRelativeFrame({ axes: 'horizontal' }),
            ]}
          >
            <Text modifiers={[font({ weight: 'bold', size: 28 }), foregroundStyle(COLORS.success)]}>
              {props.activePrograms}
            </Text>
            <Text modifiers={[font({ size: 12 }), foregroundStyle(COLORS.mutedText)]}>
              Active Programs
            </Text>
          </VStack>
        </HStack>

        {/* Footer */}
        <VStack alignment="leading" modifiers={[padding({ top: 12 })]}>
          <Text modifiers={[font({ size: 11 }), foregroundStyle(COLORS.mutedText)]}>
            Tap to open AMG Portal
          </Text>
        </VStack>
      </VStack>
    </ZStack>
  );
}

/**
 * Circular lock screen accessory - Minimal display
 */
function CircularAccessory(props: TasksWidgetProps) {
  const total = props.pendingApprovals + props.dueToday;

  return (
    <ZStack
      modifiers={[
        background(COLORS.background),
        cornerRadius(100),
      ]}
    >
      <VStack>
        <Text modifiers={[font({ weight: 'bold', size: 24 }), foregroundStyle(COLORS.warning)]}>
          {total}
        </Text>
        <Text modifiers={[font({ size: 8 }), foregroundStyle(COLORS.mutedText)]}>
          ACTION{total !== 1 ? 'S' : ''}
        </Text>
      </VStack>
    </ZStack>
  );
}

/**
 * Rectangular lock screen accessory - Extended lock screen display
 */
function RectangularAccessory(props: TasksWidgetProps) {
  return (
    <ZStack
      modifiers={[
        background(COLORS.background),
        cornerRadius(12),
        padding({ all: 10 }),
      ]}
    >
      <HStack>
        <VStack alignment="leading">
          <Text modifiers={[font({ weight: 'semibold', size: 11 }), foregroundStyle(COLORS.text)]}>
            AMG Portal
          </Text>
          <Text modifiers={[font({ size: 10 }), foregroundStyle(COLORS.mutedText)]}>
            {props.pendingApprovals} pending • {props.dueToday} due today
          </Text>
        </VStack>
        <Text modifiers={[font({ weight: 'bold', size: 18 }), foregroundStyle(COLORS.warning)]}>
          {props.pendingApprovals + props.dueToday}
        </Text>
      </HStack>
    </ZStack>
  );
}

/**
 * Main TasksWidget component - Routes to appropriate layout based on family
 */
function TasksWidgetComponent(props: TasksWidgetProps, context: WidgetEnvironment) {
  'widget';

  // Route to appropriate layout based on widget family
  switch (context.widgetFamily) {
    case 'systemSmall':
      return <SmallWidget {...props} />;
    case 'systemMedium':
      return <MediumWidget {...props} />;
    case 'systemLarge':
    case 'systemExtraLarge':
      return <LargeWidget {...props} />;
    case 'accessoryCircular':
      return <CircularAccessory {...props} />;
    case 'accessoryRectangular':
      return <RectangularAccessory {...props} />;
    default:
      return <SmallWidget {...props} />;
  }
}

// Create and export the widget
const TasksWidget = createWidget('TasksWidget', TasksWidgetComponent);

export default TasksWidget;

// Re-export types
export type { WidgetFamily, WidgetEnvironment, WidgetTimelineEntry };

/**
 * Widget update helper functions
 * These can be called from the main app to update widget content
 */

/**
 * Default empty widget props
 */
export const DEFAULT_WIDGET_PROPS: TasksWidgetProps = {
  pendingApprovals: 0,
  dueToday: 0,
  blockedTasks: 0,
  activePrograms: 0,
  lastUpdated: new Date().toISOString(),
  userName: undefined,
};

/**
 * Update the widget with new data
 * Call this from your app when data changes
 */
export function updateTasksWidget(data: Partial<TasksWidgetProps>): void {
  const props: TasksWidgetProps = {
    ...DEFAULT_WIDGET_PROPS,
    ...data,
    lastUpdated: data.lastUpdated ?? new Date().toISOString(),
  };

  // Update the widget snapshot immediately
  TasksWidget.updateSnapshot(props);
}

/**
 * Schedule widget updates throughout the day
 * Useful for showing time-sensitive information
 */
export function scheduleWidgetUpdates(
  entries: Array<{ date: Date; props: Partial<TasksWidgetProps> }>
): void {
  const timeline: WidgetTimelineEntry<TasksWidgetProps>[] = entries.map((entry) => ({
    date: entry.date,
    props: {
      ...DEFAULT_WIDGET_PROPS,
      ...entry.props,
      lastUpdated: entry.date.toISOString(),
    } as TasksWidgetProps,
  }));

  TasksWidget.updateTimeline(timeline);
}

/**
 * Force reload the widget
 */
export function reloadTasksWidget(): void {
  TasksWidget.reload();
}
