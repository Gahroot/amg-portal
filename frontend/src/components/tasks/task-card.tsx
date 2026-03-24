"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, GripVertical, Link2, MoreHorizontal, User } from "lucide-react";
import { format, isPast, isToday } from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TaskBoard } from "@/types/task";
import { TASK_PRIORITIES } from "@/types/task";

interface TaskCardProps {
  task: TaskBoard;
  onEdit: (task: TaskBoard) => void;
  onDelete: (taskId: string) => void;
  // Selection
  isSelected?: boolean;
  onToggleSelect?: (taskId: string) => void;
  selectionMode?: boolean;
  /** All tasks — used to determine if any dependency is incomplete */
  allTasks?: TaskBoard[];
  onViewDependencies?: (task: TaskBoard) => void;
}

export function TaskCard({
  task,
  onEdit,
  onDelete,
  isSelected = false,
  onToggleSelect,
  selectionMode = false,
  allTasks = [],
  onViewDependencies,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityConfig = TASK_PRIORITIES.find((p) => p.value === task.priority);
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== "done" && task.status !== "cancelled";
  const isDueToday = task.due_date && isToday(new Date(task.due_date));

  // Dependency state
  const hasDependencies = task.depends_on.length > 0 || task.blocked_by.length > 0;
  const hasIncompleteDeps = task.depends_on.some((depId) => {
    const dep = allTasks.find((t) => t.id === depId);
    return dep && dep.status !== "done" && dep.status !== "cancelled";
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-lg border bg-card p-3 shadow-sm transition-all",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary",
        isOverdue && "border-l-4 border-l-red-500",
        isSelected && "border-primary/60 bg-primary/5 ring-1 ring-primary/30",
      )}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle — hidden in selection mode; checkbox shown instead */}
        {selectionMode ? (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect?.(task.id)}
            className="mt-0.5 shrink-0"
            aria-label={`Select task: ${task.title}`}
          />
        ) : (
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          >
            <GripVertical className="size-4" />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium leading-tight">{task.title}</h4>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" className="size-6 shrink-0">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(task)}>Edit</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(task.id)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {task.description}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {task.priority !== "medium" && (
              <span className={cn("text-xs font-medium", priorityConfig?.color)}>
                {priorityConfig?.label}
              </span>
            )}

            {task.due_date && (
              <span
                className={cn(
                  "flex items-center gap-1 text-xs",
                  isOverdue ? "text-red-500" : isDueToday ? "text-orange-500" : "text-muted-foreground"
                )}
              >
                <Calendar className="size-3" />
                {format(new Date(task.due_date), "MMM d")}
              </span>
            )}

            {task.program && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {task.program.title}
              </span>
            )}
          </div>

          {task.assignee && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="size-3" />
              <span className="truncate">{task.assignee.name}</span>
            </div>
          )}

          {/* Dependency indicator */}
          {hasDependencies && (
            <button
              type="button"
              onClick={() => onViewDependencies?.(task)}
              className={cn(
                "mt-2 flex items-center gap-1 text-xs",
                hasIncompleteDeps
                  ? "text-amber-600 hover:text-amber-700"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title={
                hasIncompleteDeps
                  ? "Blocked by incomplete dependencies — click to view"
                  : "Has dependencies — click to view"
              }
            >
              <Link2 className="size-3" />
              {task.depends_on.length > 0 && (
                <span>
                  {task.depends_on.length} dep{task.depends_on.length !== 1 ? "s" : ""}
                  {hasIncompleteDeps && " ⚠"}
                </span>
              )}
              {task.blocked_by.length > 0 && (
                <span className="ml-1 text-orange-500">
                  blocking {task.blocked_by.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
