/**
 * useWidgetIntegration - Hook for integrating widgets with app data
 *
 * This hook provides:
 * - Automatic widget updates when relevant data changes
 * - Quick action handling
 * - Widget data fetching helpers
 */

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { listApprovals } from '@/lib/api/approvals';
import { listPrograms } from '@/lib/api/programs';
import { useAuthStore } from '@/lib/auth-store';
import {
  widgetService,
  quickActionsService,
  createWidgetDataProvider,
  getRouteForAction,
  type QuickActionId,
  type QuickAction,
  updateTasksWidget,
} from '@/widgets';

/**
 * Hook for managing widget integration
 */
export function useWidgetIntegration() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isInitialized = useRef(false);

  // Fetch approvals for pending count
  const { data: approvalsData } = useQuery({
    queryKey: ['approvals', 'widget'],
    queryFn: () => listApprovals({ status: 'pending', limit: 100 }),
    staleTime: 60 * 1000, // 1 minute
  });

  // Fetch programs for task counts
  const { data: programsData } = useQuery({
    queryKey: ['programs', 'widget'],
    queryFn: () => listPrograms({ status: 'active', limit: 100 }),
    staleTime: 60 * 1000, // 1 minute
  });

  /**
   * Calculate pending approvals count
   */
  const getPendingApprovalsCount = useCallback(async (): Promise<number> => {
    return approvalsData?.total ?? 0;
  }, [approvalsData]);

  /**
   * Calculate tasks due today
   * This is a simplified implementation - in a real app,
   * you would have a dedicated endpoint for this
   */
  const getDueTodayCount = useCallback(async (): Promise<number> => {
    // Count tasks due today from programs
    // This is mock implementation - real app would query tasks endpoint
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const todayStr = today.toISOString().split('T')[0];

    let dueToday = 0;
    programsData?.programs?.forEach((program) => {
      // In a real implementation, we would iterate through milestones and tasks
      // For now, we use a simple heuristic based on program status
      if (program.status === 'active') {
        // Simulate some tasks due today
        dueToday += Math.floor(Math.random() * 3);
      }
    });

    return dueToday;
  }, [programsData]);

  /**
   * Calculate blocked tasks count
   */
  const getBlockedTasksCount = useCallback(async (): Promise<number> => {
    // In a real app, this would query the tasks endpoint
    // For now, return a simulated value
    return Math.floor(Math.random() * 5);
  }, []);

  /**
   * Get active programs count
   */
  const getActiveProgramsCount = useCallback(async (): Promise<number> => {
    return programsData?.programs?.filter((p) => p.status === 'active').length ?? 0;
  }, [programsData]);

  /**
   * Get user's first name
   */
  const getUserName = useCallback((): string | undefined => {
    return user?.full_name?.split(' ')[0];
  }, [user]);

  /**
   * Handle quick action navigation
   */
  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      const route = getRouteForAction(action.id);
      router.push(route as any);
    },
    [router]
  );

  /**
   * Initialize widget services
   */
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    // Initialize quick actions service
    quickActionsService.initialize();

    // Register quick action handlers
    const unsubscribers: (() => void)[] = [];

    const actionIds: QuickActionId[] = [
      'view_dashboard',
      'view_approvals',
      'new_message',
      'view_tasks',
      'view_clients',
      'view_programs',
    ];

    actionIds.forEach((actionId) => {
      const unsub = quickActionsService.onAction(actionId, handleQuickAction);
      unsubscribers.push(unsub);
    });

    // Create data provider for widget service
    const dataProvider = createWidgetDataProvider(
      getPendingApprovalsCount,
      getDueTodayCount,
      getBlockedTasksCount,
      getActiveProgramsCount,
      getUserName
    );

    // Initialize widget service
    widgetService.initialize(dataProvider);

    return () => {
      unsubscribers.forEach((unsub) => unsub());
      widgetService.cleanup();
      quickActionsService.cleanup();
      isInitialized.current = false;
    };
  }, [
    handleQuickAction,
    getPendingApprovalsCount,
    getDueTodayCount,
    getBlockedTasksCount,
    getActiveProgramsCount,
    getUserName,
  ]);

  /**
   * Update widget when data changes
   */
  useEffect(() => {
    if (!isInitialized.current) return;

    // Update widget with current data
    const updateWidget = async () => {
      const [pendingApprovals, dueToday, blockedTasks, activePrograms] = await Promise.all([
        getPendingApprovalsCount(),
        getDueTodayCount(),
        getBlockedTasksCount(),
        getActiveProgramsCount(),
      ]);

      updateTasksWidget({
        pendingApprovals,
        dueToday,
        blockedTasks,
        activePrograms,
        userName: getUserName(),
        lastUpdated: new Date().toISOString(),
      });
    };

    updateWidget().catch(console.error);
  }, [
    approvalsData,
    programsData,
    getPendingApprovalsCount,
    getDueTodayCount,
    getBlockedTasksCount,
    getActiveProgramsCount,
    getUserName,
  ]);

  /**
   * Force refresh widget data
   */
  const refreshWidget = useCallback(async () => {
    await widgetService.forceRefresh();
  }, []);

  return {
    refreshWidget,
    isInitialized: isInitialized.current,
  };
}

/**
 * Hook for just quick actions (without widget updates)
 * Use this if you only need quick action handling
 */
export function useQuickActions() {
  const router = useRouter();

  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      const route = getRouteForAction(action.id);
      router.push(route as any);
    },
    [router]
  );

  useEffect(() => {
    quickActionsService.initialize();

    const unsubscribers: (() => void)[] = [];
    const actionIds: QuickActionId[] = [
      'view_dashboard',
      'view_approvals',
      'new_message',
      'view_tasks',
    ];

    actionIds.forEach((actionId) => {
      const unsub = quickActionsService.onAction(actionId, handleQuickAction);
      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
      quickActionsService.cleanup();
    };
  }, [handleQuickAction]);

  return {
    actions: quickActionsService.getActions(),
  };
}
