"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskCard } from "./task-card";
import type { TaskBoard, TaskStatus } from "@/types/task";

interface TaskColumnProps {
  status: TaskStatus;
  title: string;
  color: string;
  tasks: TaskBoard[];
  onAddTask: (status: TaskStatus) => void;
  onEditTask: (task: TaskBoard) => void;
  onDeleteTask: (taskId: string) => void;
}

export function TaskColumn({
  status,
  title,
  color,
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div className="flex h-full w-72 shrink-0 flex-col rounded-lg border bg-muted/30">
      <div className={cn("flex items-center justify-between rounded-t-lg px-3 py-2", color)}>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="flex size-5 items-center justify-center rounded-full bg-background/50 text-xs font-medium">
            {tasks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="size-6"
          onClick={() => onAddTask(status)}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 transition-colors",
          isOver && "bg-primary/5"
        )}
      >
        <ScrollArea className="h-full">
          <div className="space-y-2 p-2">
            <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                />
              ))}
            </SortableContext>

            {tasks.length === 0 && (
              <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                No tasks
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
