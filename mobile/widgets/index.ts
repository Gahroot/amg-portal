/**
 * AMG Portal Widgets Module
 *
 * This module provides:
 * - iOS Home Screen Widgets using expo-widgets
 * - Quick Actions (3D Touch / Long Press shortcuts)
 * - Widget data management services
 *
 * @example
 * ```typescript
 * import { useWidgetData, quickActionsService } from '@/widgets';
 *
 * // In your app initialization
 * useEffect(() => {
 *   quickActionsService.initialize();
 *   return () => quickActionsService.cleanup();
 * }, []);
 * ```
 */

// Widget components
export { default as TasksWidget, updateTasksWidget, scheduleWidgetUpdates, reloadTasksWidget } from './TasksWidget';
export type { TasksWidgetProps } from './TasksWidget';

// Widget service for data management
export {
  widgetService,
  createWidgetDataProvider,
  type WidgetDataProvider,
} from './WidgetService';

// Quick actions service
export {
  quickActionsService,
  getRouteForAction,
  QUICK_ACTION_ROUTES,
  type QuickActionId,
  type QuickAction,
  type QuickActionHandler,
} from './QuickActionsService';

// React hooks
export { useWidgetIntegration, useQuickActions } from './useWidgetIntegration';
