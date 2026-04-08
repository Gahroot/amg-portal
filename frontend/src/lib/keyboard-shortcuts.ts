/**
 * Centralized keyboard shortcuts registry
 */

import type { LucideIcon } from "lucide-react";

export interface KeyboardShortcut {
  /** Unique identifier for the shortcut */
  id: string;
  /** Display label for the shortcut */
  label: string;
  /** Optional description */
  description?: string;
  /** Category for grouping in the help dialog */
  category: ShortcutCategory;
  /** The key or keys to press (e.g., "k", "?", "/" ) - optional if sequence is provided */
  keys?: string[];
  /** Whether the shortcut requires Cmd (Mac) / Ctrl (Windows) */
  metaKey?: boolean;
  /** Whether the shortcut requires Shift */
  shiftKey?: boolean;
  /** Whether the shortcut requires Alt/Option */
  altKey?: boolean;
  /** For sequential shortcuts like "g then p" */
  sequence?: {
    firstKey: string;
    secondKey: string;
  };
  /** Optional icon to display */
  icon?: LucideIcon;
  /** Whether this shortcut is enabled (can be disabled based on user preferences) */
  enabled?: boolean;
  /** Whether this shortcut should be disabled in input fields */
  disableInInput?: boolean;
  /** Handler function - if not provided, will use global action registry */
  action?: () => void;
}

export type ShortcutCategory =
  | "navigation"
  | "actions"
  | "search"
  | "ui"
  | "lists";

export interface ShortcutCategoryInfo {
  id: ShortcutCategory;
  label: string;
  order: number;
}

export const SHORTCUT_CATEGORIES: ShortcutCategoryInfo[] = [
  { id: "navigation", label: "Navigation", order: 1 },
  { id: "actions", label: "Actions", order: 2 },
  { id: "search", label: "Search", order: 3 },
  { id: "ui", label: "Interface", order: 4 },
  { id: "lists", label: "List Navigation", order: 5 },
];

/**
 * Get the platform-specific modifier key label
 */
export function getModifierLabel(): string {
  if (typeof window === "undefined") return "Ctrl";
  return navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl";
}

/**
 * Get the platform-specific alt key label
 */
export function getAltLabel(): string {
  if (typeof window === "undefined") return "Alt";
  return navigator.platform.toLowerCase().includes("mac") ? "⌥" : "Alt";
}

/**
 * Format a key for display (e.g., "ArrowUp" -> "↑")
 */
export function formatKey(key: string): string {
  const keyMap: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Escape: "Esc",
    " ": "Space",
    Enter: "↵",
    Backspace: "⌫",
    Delete: "⌦",
    Tab: "⇥",
  };
  return keyMap[key] ?? key.toUpperCase();
}

/**
 * Format shortcut keys for display
 */
export function formatShortcutKeys(shortcut: KeyboardShortcut): string[] {
  const parts: string[] = [];

  if (shortcut.metaKey) {
    parts.push(getModifierLabel());
  }
  if (shortcut.altKey) {
    parts.push(getAltLabel());
  }
  if (shortcut.shiftKey) {
    parts.push("⇧");
  }

  if (shortcut.sequence) {
    // For sequential shortcuts, return as array of two parts
    return [shortcut.sequence.firstKey, shortcut.sequence.secondKey];
  }

  shortcut.keys?.forEach((key) => {
    parts.push(formatKey(key));
  });

  return parts;
}

/**
 * Default keyboard shortcuts configuration
 */
export const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  // Navigation
  {
    id: "go-to-programs",
    label: "Go to Programs",
    category: "navigation",
    sequence: { firstKey: "g", secondKey: "p" },
    disableInInput: true,
  },
  {
    id: "go-to-clients",
    label: "Go to Clients",
    category: "navigation",
    sequence: { firstKey: "g", secondKey: "c" },
    disableInInput: true,
  },
  {
    id: "go-to-partners",
    label: "Go to Partners",
    category: "navigation",
    sequence: { firstKey: "g", secondKey: "t" },
    disableInInput: true,
  },
  {
    id: "go-to-dashboard",
    label: "Go to Dashboard",
    category: "navigation",
    sequence: { firstKey: "g", secondKey: "d" },
    disableInInput: true,
  },

  // Actions
  {
    id: "new-item",
    label: "New Item",
    description: "Create a new item (context-aware)",
    category: "actions",
    keys: ["n"],
    disableInInput: true,
  },

  // Search
  {
    id: "command-palette",
    label: "Open Command Palette",
    category: "search",
    keys: ["k"],
    metaKey: true,
  },
  {
    id: "focus-search",
    label: "Focus Search",
    category: "search",
    keys: ["/"],
    disableInInput: true,
  },

  // UI
  {
    id: "toggle-sidebar",
    label: "Toggle Sidebar",
    category: "ui",
    keys: ["b"],
    metaKey: true,
  },
  {
    id: "show-shortcuts",
    label: "Show Keyboard Shortcuts",
    category: "ui",
    keys: ["?"],
    shiftKey: true,
    disableInInput: true,
  },
  {
    id: "toggle-focus-mode",
    label: "Toggle Focus Mode",
    description: "Hide sidebar and extras for distraction-free viewing",
    category: "ui",
    keys: ["f"],
    metaKey: true,
    shiftKey: true,
  },
  {
    id: "close-modal",
    label: "Close Modal / Panel",
    category: "ui",
    keys: ["Escape"],
  },

  // List Navigation
  {
    id: "list-up",
    label: "Navigate Up in List",
    category: "lists",
    keys: ["ArrowUp"],
    disableInInput: true,
  },
  {
    id: "list-down",
    label: "Navigate Down in List",
    category: "lists",
    keys: ["ArrowDown"],
    disableInInput: true,
  },
  {
    id: "list-select",
    label: "Select Item",
    category: "lists",
    keys: ["Enter"],
    disableInInput: true,
  },
];

/**
 * Global action registry for keyboard shortcuts
 */
type ActionHandler = () => void;

const actionRegistry = new Map<string, ActionHandler>();

/**
 * Register an action handler for a shortcut
 */
export function registerShortcutAction(
  shortcutId: string,
  handler: ActionHandler
): void {
  actionRegistry.set(shortcutId, handler);
}

/**
 * Unregister an action handler
 */
export function unregisterShortcutAction(shortcutId: string): void {
  actionRegistry.delete(shortcutId);
}

/**
 * Get the action handler for a shortcut
 */
export function getShortcutAction(shortcutId: string): ActionHandler | undefined {
  return actionRegistry.get(shortcutId);
}

/**
 * Check if a keyboard event matches a shortcut
 */
export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: KeyboardShortcut
): boolean {
  // Handle sequential shortcuts separately
  if (shortcut.sequence) {
    return false; // Sequential shortcuts are handled by the hook
  }

  // If no keys defined, can't match
  if (!shortcut.keys) return false;

  // Guard against undefined key (can happen in some browser/automation contexts)
  if (!event.key) return false;

  const key = event.key.toLowerCase();
  const matchesKey = shortcut.keys.some((k) => k.toLowerCase() === key);

  if (!matchesKey) return false;

  // Check modifiers
  if (shortcut.metaKey && !(event.metaKey || event.ctrlKey)) return false;
  if (!shortcut.metaKey && (event.metaKey || event.ctrlKey)) return false;

  if (shortcut.shiftKey && !event.shiftKey) return false;
  if (!shortcut.shiftKey && event.shiftKey) return false;

  if (shortcut.altKey && !event.altKey) return false;
  if (!shortcut.altKey && event.altKey) return false;

  return true;
}

/**
 * Check if the event target is an input element
 */
export function isInputElement(element: EventTarget | null): boolean {
  if (!element || !(element instanceof HTMLElement)) return false;

  const tagName = element.tagName.toLowerCase();
  const isEditable = element.isContentEditable;
  const isInput =
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    isEditable;

  return isInput;
}
