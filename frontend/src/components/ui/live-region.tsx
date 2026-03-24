"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type LiveRegionPoliteness = "polite" | "assertive" | "off";

export interface LiveRegionProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "role"> {
  /** Politeness level for screen reader announcements */
  politeness?: LiveRegionPoliteness;
  /** Whether the entire region should be announced as a whole */
  atomic?: boolean;
  /** Whether the region is currently relevant */
  relevant?: "additions" | "removals" | "text" | "all";
  /** Whether the region represents a busy state */
  busy?: boolean;
  /** Accessible label for the region */
  label?: string;
  /** Optional role override */
  role?: "status" | "alert" | "log" | "progressbar" | "marquee" | "timer";
}

/**
 * Live region component for screen reader announcements.
 * Creates an ARIA live region that announces content changes to screen readers.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions
 *
 * @example
 * // Status message that announces politely
 * <LiveRegion politeness="polite" aria-label="Status">
 *   {statusMessage}
 * </LiveRegion>
 *
 * @example
 * // Error message that interrupts
 * <LiveRegion politeness="assertive" atomic role="alert">
 *   {errorMessage}
 * </LiveRegion>
 */
export function LiveRegion({
  politeness = "polite",
  atomic = true,
  relevant,
  busy,
  label,
  className,
  children,
  ...props
}: LiveRegionProps) {
  return (
    <div
      role={politeness === "assertive" ? "alert" : "status"}
      aria-live={politeness === "off" ? "off" : politeness}
      aria-atomic={atomic}
      aria-relevant={relevant}
      aria-busy={busy}
      aria-label={label}
      className={cn("sr-only", className)}
      data-slot="live-region"
      {...props}
    >
      {children}
    </div>
  );
}

export interface StatusMessageProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "role"> {
  /** The status message to announce */
  message: string;
  /** Whether to announce assertively */
  assertive?: boolean;
  /** Whether the message is a loading state */
  loading?: boolean;
}

/**
 * Status message component for announcing state changes.
 *
 * @example
 * <StatusMessage message="Saving..." loading />
 * <StatusMessage message="Saved successfully!" />
 * <StatusMessage message="Error occurred" assertive />
 */
export function StatusMessage({
  message,
  assertive = false,
  loading = false,
  className,
  ...props
}: StatusMessageProps) {
  if (!message) return null;

  return (
    <LiveRegion
      politeness={assertive ? "assertive" : "polite"}
      busy={loading}
      className={className}
      aria-label={loading ? "Loading status" : "Status message"}
      {...props}
    >
      {message}
    </LiveRegion>
  );
}

export interface LoadingAnnouncerProps {
  /** Whether loading is in progress */
  isLoading: boolean;
  /** Optional loading message */
  message?: string;
  /** Progress percentage (0-100) */
  progress?: number;
}

/**
 * Announces loading states to screen readers.
 *
 * @example
 * <LoadingAnnouncer isLoading={isSubmitting} message="Submitting form..." />
 */
export function LoadingAnnouncer({
  isLoading,
  message = "Loading",
  progress,
}: LoadingAnnouncerProps) {
  const [announced, setAnnounced] = React.useState(false);

  React.useEffect(() => {
    if (isLoading && !announced) {
      setAnnounced(true);
    } else if (!isLoading && announced) {
      setAnnounced(false);
    }
  }, [isLoading, announced]);

  if (!isLoading) return null;

  const fullMessage =
    progress !== undefined
      ? `${message}... ${Math.round(progress)}% complete`
      : `${message}...`;

  return (
    <LiveRegion
      politeness="polite"
      busy
      aria-label="Loading status"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {fullMessage}
    </LiveRegion>
  );
}

export interface AlertAnnouncerProps {
  /** Alert message */
  message: string;
  /** Alert type for context */
  type?: "error" | "warning" | "success" | "info";
  /** Whether to clear after announcement */
  clearOnAnnounce?: boolean;
  /** Callback when announced */
  onAnnounced?: () => void;
}

/**
 * Announces alert messages assertively to screen readers.
 *
 * @example
 * <AlertAnnouncer message={error} type="error" onAnnounced={clearError} />
 */
export function AlertAnnouncer({
  message,
  type = "info",
  onAnnounced,
}: AlertAnnouncerProps) {
  const [announced, setAnnounced] = React.useState(false);

  React.useEffect(() => {
    if (message && !announced) {
      // Give screen reader time to process
      const timer = setTimeout(() => {
        setAnnounced(true);
        onAnnounced?.();
      }, 100);
      return () => clearTimeout(timer);
    }
    if (!message) {
      setAnnounced(false);
    }
  }, [message, announced, onAnnounced]);

  if (!message) return null;

  const typeLabel = {
    error: "Error",
    warning: "Warning",
    success: "Success",
    info: "Information",
  }[type];

  return (
    <LiveRegion
      politeness="assertive"
      role="alert"
      aria-label={`${typeLabel} alert`}
    >
      {typeLabel}: {message}
    </LiveRegion>
  );
}

export { LiveRegion as default };
