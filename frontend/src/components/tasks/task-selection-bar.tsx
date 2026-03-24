"use client";

import { X, UserCheck, RefreshCw, CalendarDays, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type BulkAction = "reassign" | "status" | "due-date" | "delete";

interface TaskSelectionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onAction: (action: BulkAction) => void;
  isLoading?: boolean;
  className?: string;
}

export function TaskSelectionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onAction,
  isLoading = false,
  className,
}: TaskSelectionBarProps) {
  if (selectedCount === 0) return null;

  const allSelected = selectedCount === totalCount;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 z-50 -translate-x-1/2",
        "flex items-center gap-3 rounded-xl border bg-background px-4 py-2.5 shadow-xl",
        "animate-in slide-in-from-bottom-2 duration-200",
        className,
      )}
    >
      {/* Close */}
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onClearSelection}
        className="size-6 shrink-0"
        disabled={isLoading}
      >
        <X className="size-4" />
        <span className="sr-only">Clear selection</span>
      </Button>

      {/* Selection count + select-all toggle */}
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <span className="tabular-nums">{selectedCount}</span>
        <span className="text-muted-foreground">
          {selectedCount === 1 ? "task" : "tasks"} selected
        </span>
        <button
          onClick={onSelectAll}
          disabled={isLoading}
          className="ml-1 text-xs text-primary underline-offset-2 hover:underline disabled:pointer-events-none disabled:opacity-50"
        >
          {allSelected ? "Deselect all" : `Select all ${totalCount}`}
        </button>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2.5 text-xs"
          onClick={() => onAction("reassign")}
          disabled={isLoading}
        >
          <UserCheck className="size-3.5" />
          Reassign
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2.5 text-xs"
          onClick={() => onAction("status")}
          disabled={isLoading}
        >
          <RefreshCw className="size-3.5" />
          Set status
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2.5 text-xs"
          onClick={() => onAction("due-date")}
          disabled={isLoading}
        >
          <CalendarDays className="size-3.5" />
          Due date
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onAction("delete")}
          disabled={isLoading}
        >
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="ml-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="size-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Applying…
        </div>
      )}
    </div>
  );
}
