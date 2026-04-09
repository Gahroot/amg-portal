"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { Kbd } from "./kbd";

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
    category?: string;
  }>;
}

const defaultShortcuts: ShortcutGroup[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["Tab"], description: "Move to next interactive element" },
      { keys: ["Shift", "Tab"], description: "Move to previous element" },
      { keys: ["Enter"], description: "Activate button or link" },
      { keys: ["Space"], description: "Activate or toggle controls" },
      { keys: ["Escape"], description: "Close dialogs and menus" },
    ],
  },
  {
    title: "Global Shortcuts",
    shortcuts: [
      { keys: ["Ctrl", "K"], description: "Open command palette" },
      { keys: ["Ctrl", "B"], description: "Toggle sidebar" },
      { keys: ["Ctrl", "/"], description: "Show keyboard shortcuts" },
      { keys: ["Ctrl", "N"], description: "Create new item" },
    ],
  },
  {
    title: "Data Tables",
    shortcuts: [
      { keys: ["↑", "↓"], description: "Navigate between rows" },
      { keys: ["←", "→"], description: "Navigate between cells" },
      { keys: ["Space"], description: "Select/deselect row" },
      { keys: ["Ctrl", "A"], description: "Select all rows" },
      { keys: ["Home"], description: "Go to first column" },
      { keys: ["End"], description: "Go to last column" },
    ],
  },
  {
    title: "Forms",
    shortcuts: [
      { keys: ["Tab"], description: "Move to next field" },
      { keys: ["Shift", "Tab"], description: "Move to previous field" },
      { keys: ["Enter"], description: "Submit form" },
      { keys: ["Space"], description: "Toggle checkboxes" },
    ],
  },
];

interface KeyboardShortcutsGuideProps {
  /** Custom shortcut groups */
  shortcuts?: ShortcutGroup[];
  /** Additional class name */
  className?: string;
  /** Whether to show in compact mode */
  compact?: boolean;
}

/**
 * Keyboard shortcuts guide component.
 * Displays available keyboard shortcuts in an accessible format.
 *
 * @example
 * <KeyboardShortcutsGuide />
 */
export function KeyboardShortcutsGuide({
  shortcuts = defaultShortcuts,
  className,
  compact = false,
}: KeyboardShortcutsGuideProps) {
  return (
    <div
      className={cn("space-y-6", className)}
      role="region"
      aria-label="Keyboard shortcuts guide"
    >
      {!compact && (
        <p className="text-sm text-muted-foreground">
          Use these keyboard shortcuts to navigate the AMG Portal efficiently.
          All functionality is accessible via keyboard.
        </p>
      )}

      {shortcuts.map((group) => (
        <section key={group.title} aria-labelledby={`shortcuts-${group.title}`}>
          <h3
            id={`shortcuts-${group.title}`}
            className={cn(
              "font-semibold mb-3",
              compact ? "text-sm" : "text-base"
            )}
          >
            {group.title}
          </h3>
          <dl className="space-y-2">
            {group.shortcuts.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-4"
              >
                <dt className="text-sm text-muted-foreground">
                  {shortcut.description}
                </dt>
                <dd className="flex items-center gap-1" aria-label={shortcut.keys.join(" plus ")}>
                  {shortcut.keys.map((key, keyIndex) => (
                    <Fragment key={key}>
                      <Kbd>{key}</Kbd>
                      {keyIndex < shortcut.keys.length - 1 && (
                        <span className="text-muted-foreground" aria-hidden="true">
                          +
                        </span>
                      )}
                    </Fragment>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {!compact && (
        <aside className="text-sm text-muted-foreground border-t pt-4">
          <p>
            <strong>Tip:</strong> Press <Kbd>Ctrl</Kbd>+<Kbd>/</Kbd> anywhere
            to quickly access this guide.
          </p>
        </aside>
      )}
    </div>
  );
}

/**
 * Compact keyboard shortcuts tooltip.
 * Shows a brief summary of the most common shortcuts.
 */
export function KeyboardShortcutsTooltip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "p-3 bg-popover border rounded-md shadow-lg max-w-xs",
        className
      )}
      role="tooltip"
    >
      <p className="text-xs font-medium mb-2">Quick Shortcuts</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Command palette</span>
          <span>
            <Kbd className="text-[9px] px-1">Ctrl</Kbd>+<Kbd className="text-[9px] px-1">K</Kbd>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Toggle sidebar</span>
          <span>
            <Kbd className="text-[9px] px-1">Ctrl</Kbd>+<Kbd className="text-[9px] px-1">B</Kbd>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">All shortcuts</span>
          <span>
            <Kbd className="text-[9px] px-1">Ctrl</Kbd>+<Kbd className="text-[9px] px-1">/</Kbd>
          </span>
        </div>
      </div>
    </div>
  );
}

export { KeyboardShortcutsGuide as default };
