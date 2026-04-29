"use client";

import { useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskBoard } from "@/components/tasks";

export default function TasksPage() {
  const addTaskRef = useRef<(() => void) | null>(null);

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Task Board</h1>
          <p className="text-muted-foreground">
            Manage and track tasks across all programs with drag-and-drop
          </p>
        </div>
        <Button
          onClick={() => addTaskRef.current?.()}
          className="gap-1.5"
        >
          <Plus className="size-4" />
          Add Task
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        <TaskBoard addTaskRef={addTaskRef} />
      </div>
    </div>
  );
}
