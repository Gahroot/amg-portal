"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A component for displaying keyboard key shortcuts
 */
export function Kbd({
  children,
  className,
  ...props
}: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}

/**
 * Display a keyboard shortcut with multiple keys
 */
export function ShortcutDisplay({
  keys,
  className,
  separator = "+",
}: {
  keys: string[];
  className?: string;
  separator?: string;
}) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {keys.map((key, index) => (
        <React.Fragment key={key}>
          <Kbd>{key}</Kbd>
          {index < keys.length - 1 && (
            <span className="text-muted-foreground text-xs">{separator}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * Display a sequential shortcut (e.g., "g then p")
 */
export function SequentialShortcutDisplay({
  firstKey,
  secondKey,
  className,
}: {
  firstKey: string;
  secondKey: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Kbd>{firstKey}</Kbd>
      <span className="text-muted-foreground text-xs">then</span>
      <Kbd>{secondKey}</Kbd>
    </div>
  );
}
