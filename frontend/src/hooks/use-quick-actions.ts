"use client";

import { useState, useMemo, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import {
  detectPageType,
  getDefaultActionsForContext,
  QUICK_ACTION_CATEGORIES,
  type QuickAction,
  type QuickActionCategory,
  type QuickActionContext,
  type PageType,
} from "@/providers/quick-actions-provider";
import { useQuickActionRegistry } from "@/hooks/use-quick-action-registry";
import { useQuickActionKeyboard } from "@/hooks/use-quick-action-keyboard";

// Re-export types and constants for consumers that import from this module
export type { QuickAction, QuickActionCategory, QuickActionContext, PageType };
export { detectPageType, getDefaultActionsForContext, QUICK_ACTION_CATEGORIES };
export { useQuickActionRegistry } from "@/hooks/use-quick-action-registry";
export { useQuickActionKeyboard } from "@/hooks/use-quick-action-keyboard";
export { useQuickActionSearch, useQuickActionSearch as useFilteredQuickActions } from "@/hooks/use-quick-action-search";

/**
 * Hook return type
 */
interface UseQuickActionsReturn {
  /** Current context */
  context: QuickActionContext;
  /** All available actions for current context (sorted) */
  actions: QuickAction[];
  /** Pinned actions */
  pinnedActions: QuickAction[];
  /** Pin an action */
  pinAction: (actionId: string) => void;
  /** Unpin an action */
  unpinAction: (actionId: string) => void;
  /** Toggle pin status */
  togglePin: (actionId: string) => void;
  /** Reorder an action */
  reorderAction: (actionId: string, newOrder: number) => void;
  /** Execute an action */
  executeAction: (action: QuickAction) => void;
  /** Whether menu is open */
  isOpen: boolean;
  /** Open menu */
  openMenu: () => void;
  /** Close menu */
  closeMenu: () => void;
  /** Toggle menu */
  toggleMenu: () => void;
}

/**
 * Standalone hook for managing quick actions.
 *
 * Composes useQuickActionRegistry, useQuickActionKeyboard, and
 * useQuickActionSearch into a single interface.
 *
 * Note: components inside a QuickActionsProvider should use the context-based
 * `useQuickActions` exported from `@/providers/quick-actions-provider` instead.
 */
export function useQuickActions(): UseQuickActionsReturn {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Build context
  const context: QuickActionContext = useMemo(
    () => ({
      pathname,
      pageType: detectPageType(pathname),
      userRole: user?.role ?? "client",
    }),
    [pathname, user?.role]
  );

  // Registry sub-hook (pin/reorder/persist)
  const {
    sortActions,
    pinnedActionIds,
    pinAction,
    unpinAction,
    togglePin,
    reorderAction,
  } = useQuickActionRegistry();

  // Raw actions for context (provider version uses router; standalone uses window.location)
  const rawActions = useMemo<QuickAction[]>(() => {
    // Build a minimal router-like shim so getDefaultActionsForContext works
    // without Next.js Router being available at call sites that use this hook.
    const locationRouter = {
      push: (href: string) => { window.location.href = href; },
    } as Parameters<typeof getDefaultActionsForContext>[2];
    return getDefaultActionsForContext(context.pageType, context.userRole, locationRouter);
  }, [context.pageType, context.userRole]);

  // Sort using registry custom order
  const actions = useMemo(() => sortActions(rawActions), [sortActions, rawActions]);

  // Pinned actions subset
  const pinnedActions = useMemo(
    () => actions.filter((a) => pinnedActionIds.includes(a.id)),
    [actions, pinnedActionIds]
  );

  // Menu helpers
  const openMenu = useCallback(() => setIsOpen(true), []);
  const closeMenu = useCallback(() => setIsOpen(false), []);
  const toggleMenu = useCallback(() => setIsOpen((prev) => !prev), []);

  // Execute action (checks disabled flag)
  const executeAction = useCallback(
    (action: QuickAction) => {
      const disabled =
        typeof action.disabled === "function"
          ? action.disabled(context)
          : action.disabled;
      if (disabled) return;
      action.handler(context);
      setIsOpen(false);
    },
    [context]
  );

  // Keyboard sub-hook (registers global listeners)
  useQuickActionKeyboard({ actions, executeAction, toggleMenu });

  return {
    context,
    actions,
    pinnedActions,
    pinAction,
    unpinAction,
    togglePin,
    reorderAction,
    executeAction,
    isOpen,
    openMenu,
    closeMenu,
    toggleMenu,
  };
}

