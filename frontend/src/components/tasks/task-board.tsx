"use client";

import {
  DndContext,
  DragOverlay,
  closestCorners,
} from "@dnd-kit/core";
import { usePathname } from "next/navigation";

import { useTaskBoard } from "@/hooks/use-task-board";
import { useNavigationState, useScrollTracker, useScrollRestore } from "@/hooks/use-navigation-state";
import { TaskBoardToolbar } from "./task-board-toolbar";
import { TaskBoardGraphPanel } from "./task-board-graph-panel";
import { TaskColumn } from "./task-column";
import { TaskDialog } from "./task-dialog";
import { TaskSelectionBar } from "./task-selection-bar";
import {
  ReassignDialog,
  StatusDialog,
  DueDateDialog,
  DeleteDialog,
} from "./bulk-task-actions";
import { TASK_STATUSES } from "@/types/task";

const TASKS_ROUTE_KEY = "/tasks";

export function TaskBoard() {
  const _pathname = usePathname();

  const { hasPendingRestore } = useNavigationState({
    routeKey: TASKS_ROUTE_KEY,
    initialFilters: {
      program: undefined,
      assignee: undefined,
      status: undefined,
      overdueOnly: false,
    },
    restoreScroll: true,
    restoreFilters: true,
  });

  useScrollTracker(TASKS_ROUTE_KEY);
  useScrollRestore(TASKS_ROUTE_KEY, hasPendingRestore);

  const board = useTaskBoard();

  if (board.tasksLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  const allTasks = board.tasksData?.tasks ?? [];
  const totalTaskCount = allTasks.length;

  return (
    <div className="flex h-full flex-col gap-4">
      <TaskBoardToolbar
        programs={board.programs}
        assignees={board.assignees}
        selectedProgram={board.selectedProgram}
        selectedAssignee={board.selectedAssignee}
        selectedStatus={board.selectedStatus}
        overdueOnly={board.overdueOnly}
        onProgramChange={board.setSelectedProgram}
        onAssigneeChange={board.setSelectedAssignee}
        onStatusChange={board.setSelectedStatus}
        onOverdueChange={board.setOverdueOnly}
        onClearFilters={board.handleClearFilters}
        tasks={allTasks}
        graphView={board.graphView}
        onToggleGraphView={() => {
          board.setGraphView((v) => !v);
          if (board.graphView) board.setGraphFocusTask(null);
        }}
        selectionMode={board.selectionMode}
        onToggleSelectionMode={board.handleToggleSelectionMode}
        onAddTask={() => board.handleAddTask("todo")}
      />

      {board.graphView ? (
        <TaskBoardGraphPanel
          tasks={allTasks}
          focusTask={board.graphFocusTask}
          onClearFocus={() => board.setGraphFocusTask(null)}
          onTaskClick={board.setGraphFocusTask}
        />
      ) : (
        <DndContext
          sensors={board.sensors}
          collisionDetection={closestCorners}
          onDragStart={board.handleDragStart}
          onDragEnd={board.handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {TASK_STATUSES.map((status) => (
              <TaskColumn
                key={status.value}
                status={status.value}
                title={status.label}
                color={status.color}
                tasks={board.tasksByStatus[status.value]}
                allTasks={allTasks}
                onAddTask={board.handleAddTask}
                onEditTask={board.handleEditTask}
                onDeleteTask={board.handleDeleteTask}
                onViewDependencies={board.handleViewDependencies}
                selectedIds={board.selectedIds}
                onToggleSelect={board.handleToggleSelect}
                selectionMode={board.selectionMode}
              />
            ))}
          </div>

          <DragOverlay>
            {board.activeTask && (
              <div className="w-64 rounded-lg border bg-card p-3 shadow-lg">
                <h4 className="text-sm font-medium">{board.activeTask.title}</h4>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <TaskSelectionBar
        selectedCount={board.selectedIds.size}
        totalCount={totalTaskCount}
        onSelectAll={board.handleSelectAll}
        onClearSelection={board.handleClearSelection}
        onAction={board.setActiveBulkAction}
        isLoading={board.bulkMutationPending}
      />

      <ReassignDialog
        open={board.activeBulkAction === "reassign"}
        onOpenChange={(open) => !open && board.setActiveBulkAction(null)}
        assignees={board.assignees}
        selectedCount={board.selectedIds.size}
        onConfirm={board.handleBulkReassign}
        isLoading={board.bulkMutationPending}
      />
      <StatusDialog
        open={board.activeBulkAction === "status"}
        onOpenChange={(open) => !open && board.setActiveBulkAction(null)}
        selectedCount={board.selectedIds.size}
        onConfirm={board.handleBulkStatus}
        isLoading={board.bulkMutationPending}
      />
      <DueDateDialog
        open={board.activeBulkAction === "due-date"}
        onOpenChange={(open) => !open && board.setActiveBulkAction(null)}
        selectedCount={board.selectedIds.size}
        onConfirm={board.handleBulkDueDate}
        isLoading={board.bulkMutationPending}
      />
      <DeleteDialog
        open={board.activeBulkAction === "delete"}
        onOpenChange={(open) => !open && board.setActiveBulkAction(null)}
        selectedCount={board.selectedIds.size}
        onConfirm={board.handleBulkDelete}
        isLoading={board.bulkMutationPending}
      />

      <TaskDialog
        open={board.dialogOpen}
        onOpenChange={board.setDialogOpen}
        task={board.editingTask}
        milestones={board.milestones}
        assignees={board.assignees}
        defaultStatus={board.defaultStatus}
        allTasks={allTasks}
        onSubmit={board.handleSubmit}
      />
    </div>
  );
}
