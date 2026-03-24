"use client";

import * as React from "react";
import { Loader2, Check, AlertCircle, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AutoSaveStatus } from "@/hooks/use-auto-save";

export interface AutoSaveIndicatorProps {
  /** Current auto-save status */
  status: AutoSaveStatus;
  /** Timestamp of the last successful save */
  lastSaved?: Date | null;
  /** Whether to show the last saved timestamp (default: true) */
  showTimestamp?: boolean;
  /** Whether to show status text (default: true) */
  showText?: boolean;
  /** Custom class name */
  className?: string;
  /** Size variant */
  size?: "sm" | "default";
  /** Whether to pulse the icon when saving */
  pulseOnSaving?: boolean;
}

/**
 * Formats a timestamp relative to now (e.g., "2 minutes ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffSeconds < 60) {
    return "just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Auto-save indicator component that displays the current save status.
 *
 * @example
 * ```tsx
 * const { status, lastSaved } = useAutoSave({ formId: 'my-form' });
 *
 * return (
 *   <div className="flex justify-between">
 *     <h1>My Form</h1>
 *     <AutoSaveIndicator status={status} lastSaved={lastSaved} />
 *   </div>
 * );
 * ```
 */
export function AutoSaveIndicator({
  status,
  lastSaved,
  showTimestamp = true,
  showText = true,
  className,
  size = "default",
  pulseOnSaving = true,
}: AutoSaveIndicatorProps) {
  const [relativeTime, setRelativeTime] = React.useState<string | null>(null);

  // Update relative time every minute
  React.useEffect(() => {
    if (!lastSaved || !showTimestamp) {
      setRelativeTime(null);
      return;
    }

    const updateTime = () => {
      setRelativeTime(formatRelativeTime(lastSaved));
    };

    updateTime();
    const intervalId = setInterval(updateTime, 60000);

    return () => clearInterval(intervalId);
  }, [lastSaved, showTimestamp]);

  const sizeClasses = size === "sm" ? "text-xs gap-1" : "text-sm gap-1.5";
  const iconSize = size === "sm" ? "size-3" : "size-4";

  const getStatusDisplay = () => {
    switch (status) {
      case "saving":
        return {
          icon: (
            <Loader2
              className={cn(iconSize, "animate-spin", pulseOnSaving && "text-primary")}
            />
          ),
          text: "Saving...",
          className: "text-muted-foreground",
        };
      case "saved":
        return {
          icon: <Check className={cn(iconSize, "text-green-600")} />,
          text: showTimestamp && relativeTime ? `Saved ${relativeTime}` : "Saved",
          className: "text-green-600",
        };
      case "error":
        return {
          icon: <AlertCircle className={cn(iconSize, "text-destructive")} />,
          text: "Failed to save",
          className: "text-destructive",
        };
      case "unsaved":
        return {
          icon: <CircleDot className={cn(iconSize, "text-amber-500")} />,
          text: "Unsaved changes",
          className: "text-amber-600",
        };
      case "idle":
      default:
        if (lastSaved && showTimestamp && relativeTime) {
          return {
            icon: <Check className={cn(iconSize, "text-muted-foreground")} />,
            text: `Saved ${relativeTime}`,
            className: "text-muted-foreground",
          };
        }
        return {
          icon: null,
          text: "",
          className: "text-muted-foreground",
        };
    }
  };

  const display = getStatusDisplay();

  if (!display.icon && !display.text) {
    return null;
  }

  return (
    <div
      data-slot="auto-save-indicator"
      data-status={status}
      className={cn(
        "inline-flex items-center",
        sizeClasses,
        display.className,
        className
      )}
      role="status"
      aria-live="polite"
    >
      {display.icon}
      {showText && <span>{display.text}</span>}
    </div>
  );
}

/**
 * Compact auto-save indicator that only shows an icon with a tooltip.
 *
 * @example
 * ```tsx
 * <AutoSaveIndicatorCompact status={status} lastSaved={lastSaved} />
 * ```
 */
export function AutoSaveIndicatorCompact({
  status,
  lastSaved,
  className,
}: Pick<AutoSaveIndicatorProps, "status" | "lastSaved" | "className">) {
  const getIcon = () => {
    switch (status) {
      case "saving":
        return <Loader2 className="size-4 animate-spin text-primary" />;
      case "saved":
        return <Check className="size-4 text-green-600" />;
      case "error":
        return <AlertCircle className="size-4 text-destructive" />;
      case "unsaved":
        return <CircleDot className="size-4 text-amber-500" />;
      default:
        return lastSaved ? (
          <Check className="size-4 text-muted-foreground" />
        ) : null;
    }
  };

  const getTooltip = () => {
    switch (status) {
      case "saving":
        return "Saving...";
      case "saved":
        return lastSaved
          ? `Saved ${formatRelativeTime(lastSaved)}`
          : "Saved";
      case "error":
        return "Failed to save";
      case "unsaved":
        return "Unsaved changes";
      default:
        return lastSaved
          ? `Last saved ${formatRelativeTime(lastSaved)}`
          : "Not saved";
    }
  };

  const icon = getIcon();
  if (!icon) return null;

  return (
    <div
      data-slot="auto-save-indicator-compact"
      data-status={status}
      className={cn("inline-flex items-center", className)}
      title={getTooltip()}
      role="status"
      aria-label={getTooltip()}
    >
      {icon}
    </div>
  );
}

/**
 * Auto-save status badge component for prominent display.
 *
 * @example
 * ```tsx
 * <AutoSaveBadge status={status} />
 * ```
 */
export function AutoSaveBadge({
  status,
  className,
}: Pick<AutoSaveIndicatorProps, "status" | "className">) {
  const getBadgeStyles = () => {
    switch (status) {
      case "saving":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "saved":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "error":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "unsaved":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getIcon = () => {
    switch (status) {
      case "saving":
        return <Loader2 className="size-3 animate-spin" />;
      case "saved":
        return <Check className="size-3" />;
      case "error":
        return <AlertCircle className="size-3" />;
      case "unsaved":
        return <CircleDot className="size-3" />;
      default:
        return null;
    }
  };

  const getText = () => {
    switch (status) {
      case "saving":
        return "Saving";
      case "saved":
        return "Saved";
      case "error":
        return "Error";
      case "unsaved":
        return "Unsaved";
      default:
        return null;
    }
  };

  const text = getText();
  if (!text) return null;

  return (
    <span
      data-slot="auto-save-badge"
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        getBadgeStyles(),
        className
      )}
    >
      {getIcon()}
      {text}
    </span>
  );
}

export default AutoSaveIndicator;
