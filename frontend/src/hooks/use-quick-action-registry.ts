"use client";

import { useState, useCallback } from "react";
import type { QuickAction } from "@/providers/quick-actions-provider";

/**
 * Persisted state for the action registry
 */
interface RegistryState {
  pinnedActions: string[];
  customOrder: Record<string, number>;
}

const STORAGE_KEY = "amg-quick-actions";

function loadRegistryState(): RegistryState {
  if (typeof window === "undefined") {
    return { pinnedActions: [], customOrder: {} };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<RegistryState>;
      return {
        pinnedActions: parsed.pinnedActions ?? [],
        customOrder: parsed.customOrder ?? {},
      };
    }
  } catch {
    // Ignore parse errors
  }

  return { pinnedActions: [], customOrder: {} };
}

function saveRegistryState(state: RegistryState): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Return type for useQuickActionRegistry
 */
export interface UseQuickActionRegistryReturn {
  /** Sort and filter actions using custom ordering */
  sortActions: (actions: QuickAction[]) => QuickAction[];
  /** Pinned action IDs */
  pinnedActionIds: string[];
  /** Check if an action is pinned */
  isPinned: (actionId: string) => boolean;
  /** Pin an action */
  pinAction: (actionId: string) => void;
  /** Unpin an action */
  unpinAction: (actionId: string) => void;
  /** Toggle pin status */
  togglePin: (actionId: string) => void;
  /** Reorder an action */
  reorderAction: (actionId: string, newOrder: number) => void;
}

/**
 * Hook for managing the quick action registry: pinning, reordering, and
 * persisting preferences to localStorage.
 */
export function useQuickActionRegistry(): UseQuickActionRegistryReturn {
  const [state, setState] = useState<RegistryState>(loadRegistryState);

  const sortActions = useCallback(
    (actions: QuickAction[]) =>
      [...actions].sort((a, b) => {
        const orderA = state.customOrder[a.id] ?? a.order ?? 100;
        const orderB = state.customOrder[b.id] ?? b.order ?? 100;
        return orderA - orderB;
      }),
    [state.customOrder]
  );

  const isPinned = useCallback(
    (actionId: string) => state.pinnedActions.includes(actionId),
    [state.pinnedActions]
  );

  const pinAction = useCallback((actionId: string) => {
    setState((prev) => {
      if (prev.pinnedActions.includes(actionId)) return prev;
      const next = { ...prev, pinnedActions: [...prev.pinnedActions, actionId] };
      saveRegistryState(next);
      return next;
    });
  }, []);

  const unpinAction = useCallback((actionId: string) => {
    setState((prev) => {
      const next = {
        ...prev,
        pinnedActions: prev.pinnedActions.filter((id) => id !== actionId),
      };
      saveRegistryState(next);
      return next;
    });
  }, []);

  const togglePin = useCallback((actionId: string) => {
    setState((prev) => {
      const pinned = prev.pinnedActions.includes(actionId);
      const next = {
        ...prev,
        pinnedActions: pinned
          ? prev.pinnedActions.filter((id) => id !== actionId)
          : [...prev.pinnedActions, actionId],
      };
      saveRegistryState(next);
      return next;
    });
  }, []);

  const reorderAction = useCallback((actionId: string, newOrder: number) => {
    setState((prev) => {
      const next = {
        ...prev,
        customOrder: { ...prev.customOrder, [actionId]: newOrder },
      };
      saveRegistryState(next);
      return next;
    });
  }, []);

  return {
    sortActions,
    pinnedActionIds: state.pinnedActions,
    isPinned,
    pinAction,
    unpinAction,
    togglePin,
    reorderAction,
  };
}
