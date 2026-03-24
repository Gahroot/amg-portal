"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Clock, AlarmClock, X } from "lucide-react";
import { SNOOZE_PRESETS, type SnoozeDurationPreset } from "@/types/communication";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow } from "date-fns";

interface SnoozeButtonProps {
  onSnooze: (durationMinutes: SnoozeDurationPreset) => void;
  onUnsnooze?: () => void;
  isSnoozed?: boolean;
  snoozedUntil?: string;
  snoozeCount?: number;
  maxSnoozeCount?: number;
  disabled?: boolean;
  compact?: boolean;
}

export function SnoozeButton({
  onSnooze,
  onUnsnooze,
  isSnoozed = false,
  snoozedUntil,
  snoozeCount = 0,
  maxSnoozeCount = 3,
  disabled = false,
  compact = false,
}: SnoozeButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const canSnooze = snoozeCount < maxSnoozeCount;
  const remainingSnoozes = maxSnoozeCount - snoozeCount;

  const formatSnoozedUntil = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return `today at ${format(date, "h:mm a")}`;
    } else if (isTomorrow(date)) {
      return `tomorrow at ${format(date, "h:mm a")}`;
    }
    return format(date, "MMM d 'at' h:mm a");
  };

  // Show snoozed state
  if (isSnoozed && snoozedUntil) {
    return (
      <div className="flex items-center gap-1">
        <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <AlarmClock className="h-3 w-3" />
          Remind {formatSnoozedUntil(snoozedUntil)}
        </span>
        {onUnsnooze && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1"
            onClick={() => onUnsnooze()}
            disabled={disabled}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  // Compact mode for dropdown lists
  if (compact) {
    return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-6 px-1.5", !canSnooze && "opacity-50")}
            disabled={disabled || !canSnooze}
          >
            <Clock className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {SNOOZE_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset.value}
              onClick={() => {
                onSnooze(preset.value);
                setIsOpen(false);
              }}
            >
              {preset.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Full mode
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-7 px-2 text-xs", !canSnooze && "opacity-50")}
          disabled={disabled || !canSnooze}
        >
          <Clock className="mr-1 h-3 w-3" />
          Snooze
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {remainingSnoozes > 1 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {remainingSnoozes} snoozes remaining
          </div>
        )}
        {remainingSnoozes === 1 && (
          <div className="px-2 py-1.5 text-xs text-amber-600 dark:text-amber-400">
            Last snooze available
          </div>
        )}
        <DropdownMenuSeparator />
        {SNOOZE_PRESETS.map((preset) => (
          <DropdownMenuItem
            key={preset.value}
            onClick={() => {
              onSnooze(preset.value);
              setIsOpen(false);
            }}
          >
            {preset.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
