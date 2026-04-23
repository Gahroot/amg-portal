/**
 * TasksWidget - non-iOS stub.
 *
 * The real widget implementation lives in `TasksWidget.ios.tsx` and depends
 * on `@expo/ui/swift-ui` + `expo-widgets`, neither of which load on web or
 * Android. Metro picks this file for those platforms so `useWidgetIntegration`
 * can be called from the shared `_layout.tsx` without crashing the bundle.
 */

export type TasksWidgetProps = {
  pendingApprovals: number;
  dueToday: number;
  blockedTasks: number;
  activePrograms: number;
  lastUpdated: string;
  userName?: string;
};

export type WidgetFamily =
  | 'systemSmall'
  | 'systemMedium'
  | 'systemLarge'
  | 'systemExtraLarge'
  | 'accessoryCircular'
  | 'accessoryRectangular'
  | 'accessoryInline';

export type WidgetEnvironment = {
  widgetFamily: WidgetFamily;
};

export type WidgetTimelineEntry<P> = {
  date: Date;
  props: P;
};

export const DEFAULT_WIDGET_PROPS: TasksWidgetProps = {
  pendingApprovals: 0,
  dueToday: 0,
  blockedTasks: 0,
  activePrograms: 0,
  lastUpdated: new Date().toISOString(),
  userName: undefined,
};

const TasksWidget = {
  updateSnapshot: (_props: TasksWidgetProps): void => {},
  updateTimeline: (_timeline: WidgetTimelineEntry<TasksWidgetProps>[]): void => {},
  reload: (): void => {},
};

export default TasksWidget;

export function updateTasksWidget(_data: Partial<TasksWidgetProps>): void {}

export function scheduleWidgetUpdates(
  _entries: Array<{ date: Date; props: Partial<TasksWidgetProps> }>
): void {}

export function reloadTasksWidget(): void {}
