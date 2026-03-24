/**
 * WidgetService - Manages widget data updates and synchronization
 *
 * This service handles:
 * - Fetching data for widget display
 * - Caching widget data for offline access
 * - Updating widgets when app data changes
 * - Scheduling periodic widget refreshes
 */

import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TasksWidgetProps, DEFAULT_WIDGET_PROPS } from './TasksWidget';

// Re-export types and update functions from TasksWidget
export { updateTasksWidget, scheduleWidgetUpdates, reloadTasksWidget, type TasksWidgetProps } from './TasksWidget';

const WIDGET_DATA_KEY = '@amg_widget_data';
const WIDGET_UPDATE_INTERVAL = 15 * 60 * 1000; // 15 minutes

/**
 * Interface for services that can provide widget data
 */
export interface WidgetDataProvider {
  getPendingApprovalsCount(): Promise<number>;
  getDueTodayCount(): Promise<number>;
  getBlockedTasksCount(): Promise<number>;
  getActiveProgramsCount(): Promise<number>;
  getUserName(): string | undefined;
}

/**
 * Default widget data when no data is available
 */
export const DEFAULT_WIDGET_DATA: TasksWidgetProps = {
  pendingApprovals: 0,
  dueToday: 0,
  blockedTasks: 0,
  activePrograms: 0,
  lastUpdated: new Date().toISOString(),
  userName: undefined,
};

/**
 * Widget data cache entry
 */
interface CachedWidgetData {
  data: TasksWidgetProps;
  timestamp: number;
}

/**
 * WidgetService class - Singleton pattern for managing widget updates
 */
class WidgetServiceClass {
  private dataProvider: WidgetDataProvider | null = null;
  private appStateSubscription: (() => void) | null = null;
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;

  /**
   * Initialize the widget service
   * Should be called once when the app starts
   */
  async initialize(provider: WidgetDataProvider): Promise<void> {
    if (this.isInitialized) {
      console.warn('WidgetService already initialized');
      return;
    }

    this.dataProvider = provider;
    this.isInitialized = true;

    // Listen for app state changes
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    ).remove;

    // Load cached data and update
    await this.updateWidgetFromCache();

    // Initial update
    await this.refreshWidgetData();

    console.log('WidgetService initialized');
  }

  /**
   * Clean up the widget service
   */
  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription();
      this.appStateSubscription = null;
    }

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.isInitialized = false;
    console.log('WidgetService cleaned up');
  }

  /**
   * Handle app state changes
   */
  private async handleAppStateChange(nextAppState: AppStateStatus): Promise<void> {
    if (nextAppState === 'active') {
      // App came to foreground - refresh widget data
      await this.refreshWidgetData();

      // Start periodic updates
      this.startPeriodicUpdates();
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App going to background - stop periodic updates
      this.stopPeriodicUpdates();
    }
  }

  /**
   * Start periodic widget updates
   */
  private startPeriodicUpdates(): void {
    this.stopPeriodicUpdates();

    this.updateInterval = setInterval(() => {
      this.refreshWidgetData().catch(console.error);
    }, WIDGET_UPDATE_INTERVAL);
  }

  /**
   * Stop periodic widget updates
   */
  private stopPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Refresh widget data from the data provider
   */
  async refreshWidgetData(): Promise<TasksWidgetProps> {
    if (!this.dataProvider) {
      console.warn('WidgetService not initialized with data provider');
      return this.getCachedData();
    }

    try {
      // Fetch all data in parallel
      const [pendingApprovals, dueToday, blockedTasks, activePrograms] = await Promise.all([
        this.dataProvider.getPendingApprovalsCount(),
        this.dataProvider.getDueTodayCount(),
        this.dataProvider.getBlockedTasksCount(),
        this.dataProvider.getActiveProgramsCount(),
      ]);

      const userName = this.dataProvider.getUserName();

      const data: TasksWidgetProps = {
        pendingApprovals,
        dueToday,
        blockedTasks,
        activePrograms,
        lastUpdated: new Date().toISOString(),
        userName,
      };

      // Cache the data
      await this.cacheData(data);

      // Update the widget
      const { updateTasksWidget } = await import('./TasksWidget');
      updateTasksWidget(data);

      console.log('Widget data refreshed:', data);
      return data;
    } catch (error) {
      console.error('Failed to refresh widget data:', error);
      return this.getCachedData();
    }
  }

  /**
   * Cache widget data for offline access
   */
  private async cacheData(data: TasksWidgetProps): Promise<void> {
    try {
      const cacheEntry: CachedWidgetData = {
        data,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(cacheEntry));
    } catch (error) {
      console.error('Failed to cache widget data:', error);
    }
  }

  /**
   * Get cached widget data
   */
  private async getCachedData(): Promise<TasksWidgetProps> {
    try {
      const cached = await AsyncStorage.getItem(WIDGET_DATA_KEY);
      if (cached) {
        const entry: CachedWidgetData = JSON.parse(cached);
        return entry.data;
      }
    } catch (error) {
      console.error('Failed to get cached widget data:', error);
    }
    return DEFAULT_WIDGET_DATA;
  }

  /**
   * Update widget from cache (for fast initial display)
   */
  private async updateWidgetFromCache(): Promise<void> {
    const cachedData = await this.getCachedData();
    const { updateTasksWidget } = await import('./TasksWidget');
    updateTasksWidget(cachedData);
  }

  /**
   * Force a widget refresh
   */
  async forceRefresh(): Promise<TasksWidgetProps> {
    return this.refreshWidgetData();
  }

  /**
   * Get current widget data
   */
  async getCurrentData(): Promise<TasksWidgetProps> {
    return this.getCachedData();
  }

  /**
   * Clear cached widget data
   */
  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(WIDGET_DATA_KEY);
    } catch (error) {
      console.error('Failed to clear widget cache:', error);
    }
  }
}

// Export singleton instance
export const widgetService = new WidgetServiceClass();

/**
 * Hook for using widget data in React components
 */
export function createWidgetDataProvider(
  getPendingApprovals: () => Promise<number>,
  getDueToday: () => Promise<number>,
  getBlockedTasks: () => Promise<number>,
  getActivePrograms: () => Promise<number>,
  getUserName: () => string | undefined
): WidgetDataProvider {
  return {
    getPendingApprovalsCount: getPendingApprovals,
    getDueTodayCount: getDueToday,
    getBlockedTasksCount: getBlockedTasks,
    getActiveProgramsCount: getActivePrograms,
    getUserName,
  };
}
