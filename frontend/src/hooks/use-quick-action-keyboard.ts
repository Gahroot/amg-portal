"use client";

import { useEffect } from "react";
import { isInputElement } from "@/lib/keyboard-shortcuts";
import type { QuickAction } from "@/providers/quick-actions-provider";

/**
 * Options for useQuickActionKeyboard
 */
export interface UseQuickActionKeyboardOptions {
  /** Available actions to match shortcuts against */
  actions: QuickAction[];
  /** Callback to execute an action (handles disabled check) */
  executeAction: (action: QuickAction) => void;
  /** Callback to toggle the quick-actions menu open/closed */
  toggleMenu: () => void;
}

/**
 * Hook that registers global keyboard listeners for quick-action shortcuts.
 *
 * - Press "A" (outside of inputs) to toggle the quick-actions menu.
 * - Press an action's configured shortcut key (outside of inputs) to run it.
 */
export function useQuickActionKeyboard({
  actions,
  executeAction,
  toggleMenu,
}: UseQuickActionKeyboardOptions): void {
  // Toggle menu with "A"
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "a" && e.key !== "A") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isInputElement(e.target)) return;
      e.preventDefault();
      toggleMenu();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggleMenu]);

  // Per-action shortcut keys
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      for (const action of actions) {
        if (!action.shortcut) continue;

        const matchesKey = e.key.toLowerCase() === action.shortcut.toLowerCase();
        const matchesMeta = action.shortcutMetaKey
          ? e.metaKey || e.ctrlKey
          : !e.metaKey && !e.ctrlKey;

        if (matchesKey && matchesMeta && !isInputElement(e.target)) {
          e.preventDefault();
          executeAction(action);
          return;
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [actions, executeAction]);
}
