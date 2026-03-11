"use client";

import { TaskBoard } from "@/components/tasks";

export default function TasksPage() {
  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Task Board</h1>
        <p className="text-muted-foreground">
          Manage and track tasks across all programs with drag-and-drop
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <TaskBoard />
      </div>
    </div>
  );
}
