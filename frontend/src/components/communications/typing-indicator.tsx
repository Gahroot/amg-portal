"use client";

import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  count?: number;
  className?: string;
}

export function TypingIndicator({ count = 1, className }: TypingIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2 px-4 py-2", className)}>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">
          {count === 1 ? "Someone is" : `${count} people are`} typing
        </span>
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
