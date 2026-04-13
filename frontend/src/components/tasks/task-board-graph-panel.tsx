"use client";

import { TaskDependencyGraph } from "./task-dependency-graph";
import type { TaskBoard } from "@/types/task";

interface TaskBoardGraphPanelProps {
  tasks: TaskBoard[];
  focusTask: TaskBoard | null;
  onClearFocus: () => void;
  onTaskClick: (task: TaskBoard) => void;
}

export function TaskBoardGraphPanel({
  tasks,
  focusTask,
  onClearFocus,
  onTaskClick,
}: TaskBoardGraphPanelProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Dependency Graph</h3>
          <p className="text-xs text-muted-foreground">
            Arrows show task dependencies (A → B means B depends on A).
            {focusTask && (
              <span className="ml-1">
                Focused on: <strong>{focusTask.title}</strong>
                {" · "}
                <button type="button" className="underline" onClick={onClearFocus}>
                  Clear focus
                </button>
              </span>
            )}
          </p>
        </div>
      </div>
      <TaskDependencyGraph
        tasks={tasks}
        focusTaskId={focusTask?.id ?? null}
        onTaskClick={onTaskClick}
      />
    </div>
  );
}
