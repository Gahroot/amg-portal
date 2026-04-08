"use client";

import { useState, useRef, useCallback, useMemo, useEffect, type RefObject, type KeyboardEvent } from "react";
import { isInputElement } from "@/lib/keyboard-shortcuts";

/**
 * Position options for the quick actions bar
 */
export type QuickActionsBarPosition = 
  | "bottom-center"
  | "bottom-left"
  | "bottom-right"
  | "top-center"
  | "top-left"
  | "top-right";

/**
 * Display mode for the quick actions bar
 */
export type QuickActionsBarMode = 
  | "always"      // Always visible
  | "auto"        // Auto-hide based on inactivity
  | "focus-only"; // Only visible when focused via keyboard

/**
 * Quick actions bar configuration
 */
export interface QuickActionsBarConfig {
  /** Position of the bar */
  position?: QuickActionsBarPosition;
  /** Display mode */
  mode?: QuickActionsBarMode;
  /** Keyboard shortcut to focus the bar */
  focusShortcut?: string;
  /** Whether shortcuts require meta key (Cmd/Ctrl) */
  focusShortcutMetaKey?: boolean;
  /** Auto-hide timeout in milliseconds (for 'auto' mode) */
  autoHideTimeout?: number;
  /** Maximum number of actions to show */
  maxActions?: number;
  /** Whether to show labels */
  showLabels?: boolean;
  /** Whether to show shortcuts */
  showShortcuts?: boolean;
  /** Whether customization (pin/reorder) is enabled */
  allowCustomization?: boolean;
}

/**
 * Quick actions bar state
 */
interface QuickActionsBarState {
  /** Whether the bar is visible */
  isVisible: boolean;
  /** Whether the bar is focused */
  isFocused: boolean;
  /** Currently focused action index (-1 means bar itself is focused) */
  focusedIndex: number;
  /** Whether in customization mode */
  customizeMode: boolean;
  /** Action being dragged (for reorder) */
  draggingActionId: string | null;
}

/**
 * Hook return type
 */
interface UseQuickActionsBarReturn {
  /** Current state */
  state: QuickActionsBarState;
  /** Bar ref for focus management */
  barRef: RefObject<HTMLDivElement | null>;
  /** Show the bar */
  showBar: () => void;
  /** Hide the bar */
  hideBar: () => void;
  /** Toggle bar visibility */
  toggleBar: () => void;
  /** Focus the bar */
  focusBar: () => void;
  /** Focus next action */
  focusNext: () => void;
  /** Focus previous action */
  focusPrevious: () => void;
  /** Focus action at index */
  focusAction: (index: number) => void;
  /** Activate currently focused action */
  activateFocused: () => void;
  /** Enter customization mode */
  enterCustomizeMode: () => void;
  /** Exit customization mode */
  exitCustomizeMode: () => void;
  /** Start dragging an action */
  startDrag: (actionId: string) => void;
  /** End dragging */
  endDrag: () => void;
  /** Handle keyboard events */
  handleKeyDown: (event: KeyboardEvent) => void;
  /** Config */
  config: Required<QuickActionsBarConfig>;
}

const DEFAULT_CONFIG: Required<QuickActionsBarConfig> = {
  position: "bottom-center",
  mode: "auto",
  focusShortcut: "'",
  focusShortcutMetaKey: false,
  autoHideTimeout: 3000,
  maxActions: 8,
  showLabels: true,
  showShortcuts: true,
  allowCustomization: true,
};

const STORAGE_KEY = "amg-quick-actions-bar-config";

/**
 * Load saved config from localStorage
 */
function loadConfig(): Required<QuickActionsBarConfig> {
  if (typeof window === "undefined") return DEFAULT_CONFIG;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch {
    // Ignore parse errors
  }

  return DEFAULT_CONFIG;
}

/**
 * Hook for managing quick actions bar state and keyboard navigation
 */
export function useQuickActionsBar(
  actionCount: number,
  onActivateAction: (index: number) => void,
  config?: QuickActionsBarConfig
): UseQuickActionsBarReturn {
  const mergedConfig = useMemo(
    () => ({ ...loadConfig(), ...config }),
    [config]
  );

  const [state, setState] = useState<QuickActionsBarState>({
    isVisible: mergedConfig.mode === "always",
    isFocused: false,
    focusedIndex: -1,
    customizeMode: false,
    draggingActionId: null,
  });

  const barRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear auto-hide timeout
  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // Start auto-hide timer
  const startAutoHide = useCallback(() => {
    if (mergedConfig.mode !== "auto") return;
    
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      setState((prev) => {
        if (prev.isFocused) return prev; // Don't hide if focused
        return { ...prev, isVisible: false };
      });
    }, mergedConfig.autoHideTimeout);
  }, [mergedConfig.mode, mergedConfig.autoHideTimeout, clearHideTimeout]);

  // Show the bar
  const showBar = useCallback(() => {
    clearHideTimeout();
    setState((prev) => ({ ...prev, isVisible: true }));
    
    // Start auto-hide if in auto mode
    if (mergedConfig.mode === "auto") {
      startAutoHide();
    }
  }, [mergedConfig.mode, clearHideTimeout, startAutoHide]);

  // Hide the bar
  const hideBar = useCallback(() => {
    clearHideTimeout();
    setState((prev) => ({ 
      ...prev, 
      isVisible: false, 
      isFocused: false, 
      focusedIndex: -1,
      customizeMode: false,
    }));
  }, [clearHideTimeout]);

  // Toggle bar visibility
  const toggleBar = useCallback(() => {
    setState((prev) => {
      if (prev.isVisible) {
        clearHideTimeout();
        return { 
          ...prev, 
          isVisible: false, 
          isFocused: false, 
          focusedIndex: -1,
        };
      }
      return { ...prev, isVisible: true };
    });
  }, [clearHideTimeout]);

  // Focus the bar
  const focusBar = useCallback(() => {
    clearHideTimeout();
    setState((prev) => ({ ...prev, isVisible: true, isFocused: true, focusedIndex: -1 }));
    barRef.current?.focus();
  }, [clearHideTimeout]);

  // Focus next action
  const focusNext = useCallback(() => {
    setState((prev) => {
      const nextIndex = prev.focusedIndex >= actionCount - 1 ? 0 : prev.focusedIndex + 1;
      return { ...prev, focusedIndex: nextIndex, isVisible: true };
    });
  }, [actionCount]);

  // Focus previous action
  const focusPrevious = useCallback(() => {
    setState((prev) => {
      const prevIndex = prev.focusedIndex <= 0 ? actionCount - 1 : prev.focusedIndex - 1;
      return { ...prev, focusedIndex: prevIndex, isVisible: true };
    });
  }, [actionCount]);

  // Focus action at index
  const focusAction = useCallback((index: number) => {
    if (index < 0 || index >= actionCount) return;
    setState((prev) => ({ ...prev, focusedIndex: index, isVisible: true }));
  }, [actionCount]);

  // Activate focused action
  const activateFocused = useCallback(() => {
    if (state.focusedIndex >= 0 && state.focusedIndex < actionCount) {
      onActivateAction(state.focusedIndex);
    }
  }, [state.focusedIndex, actionCount, onActivateAction]);

  // Enter customization mode
  const enterCustomizeMode = useCallback(() => {
    setState((prev) => ({ ...prev, customizeMode: true }));
  }, []);

  // Exit customization mode
  const exitCustomizeMode = useCallback(() => {
    setState((prev) => ({ ...prev, customizeMode: false }));
  }, []);

  // Start dragging
  const startDrag = useCallback((actionId: string) => {
    setState((prev) => ({ ...prev, draggingActionId: actionId }));
  }, []);

  // End dragging
  const endDrag = useCallback(() => {
    setState((prev) => ({ ...prev, draggingActionId: null }));
  }, []);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusNext();
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusPrevious();
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        activateFocused();
        break;
      case "Escape":
        event.preventDefault();
        if (state.customizeMode) {
          exitCustomizeMode();
        } else if (state.focusedIndex >= 0) {
          setState((prev) => ({ ...prev, focusedIndex: -1 }));
        } else {
          hideBar();
        }
        break;
      case "Home":
        event.preventDefault();
        focusAction(0);
        break;
      case "End":
        event.preventDefault();
        focusAction(actionCount - 1);
        break;
    }
  }, [focusNext, focusPrevious, activateFocused, state.customizeMode, state.focusedIndex, exitCustomizeMode, hideBar, focusAction, actionCount]);

  // Global keyboard shortcut to focus the bar
  useEffect(() => {
    const shortcut = mergedConfig.focusShortcut;
    const requiresMeta = mergedConfig.focusShortcutMetaKey;

    function handleGlobalKeyDown(e: globalThis.KeyboardEvent) {
      if (!e.key) return;
      const key = e.key.toLowerCase();
      const matchesKey = shortcut.toLowerCase() === key;
      const matchesMeta = requiresMeta
        ? e.metaKey || e.ctrlKey
        : !e.metaKey && !e.ctrlKey;

      if (matchesKey && matchesMeta && !isInputElement(e.target)) {
        e.preventDefault();
        focusBar();
      }
    }

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [mergedConfig.focusShortcut, mergedConfig.focusShortcutMetaKey, focusBar]);

  // Handle focus events
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    function handleFocus() {
      clearHideTimeout();
      setState((prev) => ({ ...prev, isFocused: true, isVisible: true }));
    }

    function handleBlur() {
      setState((prev) => ({ ...prev, isFocused: false, focusedIndex: -1 }));
      startAutoHide();
    }

    bar.addEventListener("focus", handleFocus, true);
    bar.addEventListener("blur", handleBlur, true);

    return () => {
      bar.removeEventListener("focus", handleFocus, true);
      bar.removeEventListener("blur", handleBlur, true);
    };
  }, [clearHideTimeout, startAutoHide]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => clearHideTimeout();
  }, [clearHideTimeout]);

  return {
    state,
    barRef,
    showBar,
    hideBar,
    toggleBar,
    focusBar,
    focusNext,
    focusPrevious,
    focusAction,
    activateFocused,
    enterCustomizeMode,
    exitCustomizeMode,
    startDrag,
    endDrag,
    handleKeyDown,
    config: mergedConfig,
  };
}

/**
 * Get position classes for the quick actions bar
 */
export function getBarPositionClasses(position: QuickActionsBarPosition): string {
  const positions: Record<QuickActionsBarPosition, string> = {
    "bottom-center": "bottom-6 left-1/2 -translate-x-1/2",
    "bottom-left": "bottom-6 left-6",
    "bottom-right": "bottom-6 right-6",
    "top-center": "top-20 left-1/2 -translate-x-1/2",
    "top-left": "top-20 left-6",
    "top-right": "top-20 right-6",
  };
  return positions[position];
}
