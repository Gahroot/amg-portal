"use client";

import { useMemo } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFocusMode } from "@/hooks/use-focus-mode";
import { cn } from "@/lib/utils";

interface FocusModeToggleProps {
  /** Additional class names */
  className?: string;
  /** Show as icon button (default) or with label */
  variant?: "icon" | "label";
}

/**
 * Toggle button for focus mode
 * Shows maximize icon when not in focus mode, minimize when in focus mode
 */
export function FocusModeToggle({
  className,
  variant = "icon",
}: FocusModeToggleProps) {
  const { isFocusMode, toggleFocusMode } = useFocusMode();

  const shortcutHint = useMemo(() => {
    const isMac =
      typeof window !== "undefined" &&
      navigator.platform.toLowerCase().includes("mac");
    return isMac ? "⌘⇧F" : "Ctrl+Shift+F";
  }, []);

  if (variant === "label") {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleFocusMode}
        className={cn("gap-2", className)}
        aria-label={isFocusMode ? "Exit focus mode" : "Enter focus mode"}
        aria-pressed={isFocusMode}
      >
        {isFocusMode ? (
          <Minimize2 className="h-4 w-4" />
        ) : (
          <Maximize2 className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">
          {isFocusMode ? "Exit Focus" : "Focus Mode"}
        </span>
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFocusMode}
          className={cn("size-8", className)}
          aria-label={isFocusMode ? "Exit focus mode" : "Enter focus mode"}
          aria-pressed={isFocusMode}
          data-focus-mode-toggle
        >
          {isFocusMode ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2">
        <span>{isFocusMode ? "Exit Focus Mode" : "Focus Mode"}</span>
        <kbd className="pointer-events-none ml-1 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          {shortcutHint}
        </kbd>
      </TooltipContent>
    </Tooltip>
  );
}
