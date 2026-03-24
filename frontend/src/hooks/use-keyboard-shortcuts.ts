"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_SHORTCUTS,
  matchesShortcut,
  isInputElement,
  registerShortcutAction,
  unregisterShortcutAction,
  type KeyboardShortcut,
} from "@/lib/keyboard-shortcuts";

interface UseKeyboardShortcutsOptions {
  /** Override the default shortcuts */
  shortcuts?: KeyboardShortcut[];
  /** Called when the shortcuts dialog should open */
  onShowShortcuts?: () => void;
  /** Called when command palette should open */
  onOpenCommandPalette?: () => void;
  /** Called when sidebar should toggle */
  onToggleSidebar?: () => void;
  /** Called when search should be focused */
  onFocusSearch?: () => void;
  /** Called when a new item action is triggered */
  onNewItem?: () => void;
  /** Called when focus mode should toggle */
  onToggleFocusMode?: () => void;
  /** Whether shortcuts are enabled */
  enabled?: boolean;
}

interface SequentialShortcutState {
  firstKeyPressed: string | null;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

/**
 * Hook for handling global keyboard shortcuts
 */
export function useKeyboardShortcuts({
  shortcuts = DEFAULT_SHORTCUTS,
  onShowShortcuts,
  onOpenCommandPalette,
  onToggleSidebar,
  onFocusSearch,
  onNewItem,
  onToggleFocusMode,
  enabled = true,
}: UseKeyboardShortcutsOptions = {}) {
  const router = useRouter();
  const sequentialState = React.useRef<SequentialShortcutState>({
    firstKeyPressed: null,
    timeoutId: null,
  });

  // Execute a shortcut's action - defined first as it's used by other callbacks
  const executeShortcutAction = React.useCallback(
    (shortcut: KeyboardShortcut) => {
      switch (shortcut.id) {
        case "show-shortcuts":
          onShowShortcuts?.();
          break;
        case "command-palette":
          onOpenCommandPalette?.();
          break;
        case "toggle-sidebar":
          onToggleSidebar?.();
          break;
        case "focus-search":
          onFocusSearch?.();
          break;
        case "new-item":
          onNewItem?.();
          break;
        case "toggle-focus-mode":
          onToggleFocusMode?.();
          break;
        case "go-to-programs":
          router.push("/programs");
          break;
        case "go-to-clients":
          router.push("/clients");
          break;
        case "go-to-partners":
          router.push("/partners");
          break;
        case "go-to-dashboard":
          router.push("/");
          break;
        default:
          // Check if there's a registered action
          if (shortcut.action) {
            shortcut.action();
          }
          break;
      }
    },
    [router, onShowShortcuts, onOpenCommandPalette, onToggleSidebar, onFocusSearch, onNewItem, onToggleFocusMode]
  );

  // Handle sequential shortcuts (g then p, etc.)
  const handleSequentialShortcut = React.useCallback(
    (key: string): boolean => {
      const state = sequentialState.current;

      // Clear any existing timeout
      if (state.timeoutId) {
        clearTimeout(state.timeoutId);
        state.timeoutId = null;
      }

      // Find shortcuts that start with this key as the first in a sequence
      const matchingFirstKey = shortcuts.find(
        (s) => s.sequence?.firstKey.toLowerCase() === key.toLowerCase()
      );

      // If we already have a first key pressed, check for second key
      if (state.firstKeyPressed) {
        const firstKey = state.firstKeyPressed;
        const matchingShortcut = shortcuts.find(
          (s) =>
            s.sequence &&
            s.sequence.firstKey.toLowerCase() === firstKey.toLowerCase() &&
            s.sequence.secondKey.toLowerCase() === key.toLowerCase()
        );

        // Reset state
        state.firstKeyPressed = null;

        if (matchingShortcut) {
          executeShortcutAction(matchingShortcut);
          return true;
        }
      }

      // If this key could be the start of a sequence
      if (matchingFirstKey) {
        state.firstKeyPressed = key;
        // Set a timeout to reset if second key isn't pressed
        state.timeoutId = setTimeout(() => {
          state.firstKeyPressed = null;
          state.timeoutId = null;
        }, 1000);
        return true;
      }

      return false;
    },
    [shortcuts, executeShortcutAction]
  );

  // Main keyboard event handler
  React.useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key;

      // Handle Escape key - let dialogs handle it themselves
      if (key === "Escape") {
        return;
      }

      // Check if we're in an input element
      const inInput = isInputElement(event.target);

      // First check for sequential shortcuts
      if (handleSequentialShortcut(key)) {
        return;
      }

      // Find matching shortcut
      for (const shortcut of shortcuts) {
        // Skip if disabled in input and we're in an input
        if (shortcut.disableInInput && inInput) continue;

        if (matchesShortcut(event, shortcut)) {
          event.preventDefault();
          executeShortcutAction(shortcut);
          return;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, shortcuts, handleSequentialShortcut, executeShortcutAction]);

  // Return a function to programmatically trigger a shortcut
  const triggerShortcut = React.useCallback(
    (shortcutId: string) => {
      const shortcut = shortcuts.find((s) => s.id === shortcutId);
      if (shortcut) {
        executeShortcutAction(shortcut);
      }
    },
    [shortcuts, executeShortcutAction]
  );

  return { triggerShortcut };
}

/**
 * Hook to focus a search input when "/" is pressed
 */
export function useFocusSearch(
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
) {
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "/" && !isInputElement(event.target)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inputRef]);
}

export { registerShortcutAction, unregisterShortcutAction };
