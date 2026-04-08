"use client";

import { useState } from "react";
import { X, Link2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TaskBoard } from "@/types/task";

interface TaskDependencyFieldProps {
  /** The task being edited (used to exclude it from the list) */
  taskId: string | null;
  /** Current list of dependency IDs */
  value: string[];
  /** All available tasks (excluding self) */
  availableTasks: TaskBoard[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function TaskDependencyField({
  taskId,
  value,
  availableTasks,
  onChange,
  disabled = false,
}: TaskDependencyFieldProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const eligibleTasks = availableTasks.filter(
    (t) =>
      t.id !== taskId &&
      !value.includes(t.id) &&
      (search.trim() === "" ||
        t.title.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedTasks = availableTasks.filter((t) => value.includes(t.id));

  const handleAdd = (id: string) => {
    onChange([...value, id]);
    setSearch("");
    setOpen(false);
  };

  const handleRemove = (id: string) => {
    onChange(value.filter((v) => v !== id));
  };

  return (
    <div className="space-y-2">
      {/* Selected dependencies */}
      {selectedTasks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTasks.map((task) => (
            <Badge
              key={task.id}
              variant="secondary"
              className={cn(
                "flex items-center gap-1 pr-1",
                task.status === "done" && "opacity-60 line-through",
              )}
            >
              <Link2 className="size-3 shrink-0" />
              <span className="max-w-[160px] truncate">{task.title}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(task.id)}
                  className="ml-0.5 rounded hover:bg-muted-foreground/20"
                  aria-label={`Remove dependency: ${task.title}`}
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Add dependency picker */}
      {!disabled && (
        <div className="relative">
          {open ? (
            <div className="rounded-md border bg-popover shadow-md">
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <Search className="size-4 text-muted-foreground" />
                <input
                  autoFocus
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Search tasks..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setOpen(false);
                      setSearch("");
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setSearch("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto py-1">
                {eligibleTasks.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    {search ? "No matching tasks" : "No available tasks"}
                  </p>
                ) : (
                  eligibleTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => handleAdd(task.id)}
                    >
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          task.status === "done" && "bg-green-500",
                          task.status === "in_progress" && "bg-blue-500",
                          task.status === "blocked" && "bg-red-500",
                          task.status === "todo" && "bg-muted-foreground",
                          task.status === "cancelled" && "bg-muted-foreground",
                        )}
                      />
                      <span className="flex-1 truncate">{task.title}</span>
                      {task.program && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {task.program.title}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={() => setOpen(true)}
            >
              <Link2 className="size-4" />
              Add dependency...
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
