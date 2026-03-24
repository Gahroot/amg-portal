/**
 * QuickActionsService - Home screen quick actions (App Shortcuts)
 *
 * Provides 3D Touch / Haptic Touch shortcuts on iOS and
 * long-press shortcuts on Android.
 *
 * Actions:
 * - View Dashboard
 * - View Approvals
 * - New Message
 * - View Tasks
 */

import { Platform, Linking } from 'react-native';
import * as LinkingExpo from 'expo-linking';

/**
 * Quick action identifiers
 */
export type QuickActionId =
  | 'view_dashboard'
  | 'view_approvals'
  | 'new_message'
  | 'view_tasks'
  | 'view_clients'
  | 'view_programs';

/**
 * Quick action configuration
 */
export interface QuickAction {
  id: QuickActionId;
  title: string;
  subtitle?: string;
  icon?: string; // iOS SF Symbol name or Android resource name
  url: string;
}

/**
 * Default quick actions configuration
 */
const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'view_dashboard',
    title: 'Dashboard',
    subtitle: 'View your overview',
    icon: Platform.select({
      ios: 'house.fill',
      android: 'ic_home',
    }),
    url: 'amgportal://dashboard',
  },
  {
    id: 'view_approvals',
    title: 'Approvals',
    subtitle: 'Review pending items',
    icon: Platform.select({
      ios: 'checkmark.circle.fill',
      android: 'ic_check',
    }),
    url: 'amgportal://approvals',
  },
  {
    id: 'new_message',
    title: 'New Message',
    subtitle: 'Start a conversation',
    icon: Platform.select({
      ios: 'square.and.pencil',
      android: 'ic_message',
    }),
    url: 'amgportal://messages/new',
  },
  {
    id: 'view_tasks',
    title: 'Tasks',
    subtitle: 'View task board',
    icon: Platform.select({
      ios: 'checklist',
      android: 'ic_task',
    }),
    url: 'amgportal://tasks',
  },
];

/**
 * Quick action event handler
 */
export type QuickActionHandler = (action: QuickAction) => void;

/**
 * QuickActionsService class
 */
class QuickActionsServiceClass {
  private handlers: Map<QuickActionId, QuickActionHandler[]> = new Map();
  private linkingSubscription: { remove: () => void } | null = null;
  private isInitialized = false;

  /**
   * Initialize the quick actions service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('QuickActionsService already initialized');
      return;
    }

    this.isInitialized = true;

    // Listen for incoming URLs (from quick actions)
    this.linkingSubscription = LinkingExpo.addEventListener('url', this.handleDeepLink.bind(this));

    // Handle initial URL if app was opened from a quick action
    const initialUrl = await LinkingExpo.getInitialURL();
    if (initialUrl) {
      this.handleDeepLink({ url: initialUrl });
    }

    console.log('QuickActionsService initialized');
  }

  /**
   * Clean up the quick actions service
   */
  cleanup(): void {
    if (this.linkingSubscription) {
      this.linkingSubscription.remove();
      this.linkingSubscription = null;
    }
    this.handlers.clear();
    this.isInitialized = false;
    console.log('QuickActionsService cleaned up');
  }

  /**
   * Handle deep link URL
   */
  private handleDeepLink(event: { url: string }): void {
    const url = event.url;
    console.log('Quick action URL received:', url);

    // Parse the URL and find matching action
    const action = this.findActionByUrl(url);
    if (action) {
      this.executeAction(action);
    }
  }

  /**
   * Find action by URL
   */
  private findActionByUrl(url: string): QuickAction | undefined {
    // Handle both amgportal:// scheme and universal links
    const normalizedUrl = url.replace('amgportal://', '').replace(/^\/+/, '');

    for (const action of DEFAULT_QUICK_ACTIONS) {
      const actionPath = action.url.replace('amgportal://', '').replace(/^\/+/, '');
      if (normalizedUrl === actionPath || normalizedUrl.startsWith(actionPath + '/')) {
        return action;
      }
    }

    // Try to match custom URLs
    return undefined;
  }

  /**
   * Execute a quick action
   */
  private executeAction(action: QuickAction): void {
    const handlers = this.handlers.get(action.id) || [];
    handlers.forEach((handler) => {
      try {
        handler(action);
      } catch (error) {
        console.error(`Error in quick action handler for ${action.id}:`, error);
      }
    });
  }

  /**
   * Register a handler for a specific quick action
   */
  onAction(actionId: QuickActionId, handler: QuickActionHandler): () => void {
    if (!this.handlers.has(actionId)) {
      this.handlers.set(actionId, []);
    }
    this.handlers.get(actionId)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(actionId);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index !== -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Get all available quick actions
   */
  getActions(): QuickAction[] {
    return [...DEFAULT_QUICK_ACTIONS];
  }

  /**
   * Navigate to a URL using the app's routing
   */
  navigateTo(url: string): void {
    LinkingExpo.openURL(url).catch((error) => {
      console.error('Failed to navigate:', error);
    });
  }

  /**
   * Check if app was opened from a quick action
   */
  async getInitialAction(): Promise<QuickAction | null> {
    const initialUrl = await LinkingExpo.getInitialURL();
    if (initialUrl) {
      return this.findActionByUrl(initialUrl) || null;
    }
    return null;
  }
}

// Export singleton instance
export const quickActionsService = new QuickActionsServiceClass();

/**
 * Route mapping for quick actions to app screens
 */
export const QUICK_ACTION_ROUTES: Record<QuickActionId, string> = {
  view_dashboard: '/(internal)',
  view_approvals: '/(internal)/approvals',
  new_message: '/(internal)/messages/new',
  view_tasks: '/(internal)/tasks',
  view_clients: '/(internal)/clients',
  view_programs: '/(internal)/programs',
};

/**
 * Helper function to get route for a quick action
 */
export function getRouteForAction(actionId: QuickActionId): string {
  return QUICK_ACTION_ROUTES[actionId] || '/(internal)';
}
