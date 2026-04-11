"use client";

import { useState, useMemo, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePathname } from "next/navigation";
import { format } from "date-fns";

import { TaskColumn } from "./task-column";
import { TaskFilters } from "./task-filters";
import { TaskDialog } from "./task-dialog";
import { TaskSelectionBar } from "./task-selection-bar";
import {
  ReassignDialog,
  StatusDialog,
  DueDateDialog,
  DeleteDialog,
  type BulkActionType,
} from "./bulk-task-actions";
import { Button } from "@/components/ui/button";
import { DataTableExport } from "@/components/ui/data-table-export";
import type { ExportColumn } from "@/lib/export-utils";
import { API_BASE_URL } from "@/lib/constants";
import { CheckSquare, GitBranch, Plus } from "lucide-react";
import {
  getTasks,
  createTask,
  updateTask,
  updateTaskDependencies,
  deleteTask,
  reorderTask,
  bulkUpdateTasks,
  getProgramsForFilter,
  getAssigneesForFilter,
} from "@/lib/api/tasks";
import { TaskDependencyGraph } from "./task-dependency-graph";
import type {
  TaskBoard,
  TaskStatus,
  TaskPriority,
  MilestoneInfo,
} from "@/types/task";
import { TASK_STATUSES } from "@/types/task";
import {
  useNavigationState,
  useScrollTracker,
  useScrollRestore,
} from "@/hooks/use-navigation-state";

const TASKS_ROUTE_KEY = "/tasks";

const TASK_EXPORT_COLUMNS: ExportColumn<TaskBoard>[] = [
  { header: "Title", accessor: "title" },
  { header: "Status", accessor: "status" },
  { header: "Priority", accessor: "priority" },
  { header: "Due Date", accessor: (r) => r.due_date ?? "" },
  { header: "Assigned To", accessor: (r) => r.assignee?.name ?? "" },
  { header: "Program", accessor: (r) => r.program?.title ?? "" },
  { header: "Milestone", accessor: (r) => r.milestone?.title ?? "" },
  { header: "Description", accessor: (r) => r.description ?? "" },
  { header: "Created", accessor: (r) => new Date(r.created_at).toLocaleDateString() },
];

export function TaskBoard() {
  const queryClient = useQueryClient();
  const _pathname = usePathname();

  // Navigation state for scroll and filter preservation
  const {
    restoreScrollPosition: _restoreScrollPosition,
    markForRestore: _markForRestore,
    resetFilters: _resetFilters,
    hasPendingRestore,
  } = useNavigationState({
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

  // Track scroll position for restoration
  useScrollTracker(TASKS_ROUTE_KEY);

  // Restore scroll position after data loads
  useScrollRestore(TASKS_ROUTE_KEY, hasPendingRestore);

  // Filter state
  const [selectedProgram, setSelectedProgram] = useState<string | undefined>();
  const [selectedAssignee, setSelectedAssignee] = useState<string | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskBoard | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");

  // Drag state
  const [activeTask, setActiveTask] = useState<TaskBoard | null>(null);

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeBulkAction, setActiveBulkAction] = useState<BulkActionType>(null);

  // Graph view state
  const [graphView, setGraphView] = useState(false);
  const [graphFocusTask, setGraphFocusTask] = useState<TaskBoard | null>(null);

  // Queries
  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks", selectedProgram, selectedAssignee, selectedStatus, overdueOnly],
    queryFn: () =>
      getTasks({
        program_id: selectedProgram,
        assignee_id: selectedAssignee,
        status: selectedStatus,
        overdue_only: overdueOnly,
        limit: 500,
      }),
  });

  const { data: programs = [] } = useQuery({
    queryKey: ["task-programs"],
    queryFn: getProgramsForFilter,
  });

  const { data: assignees = [] } = useQuery({
    queryKey: ["task-assignees"],
    queryFn: getAssigneesForFilter,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task created successfully");
    },
    onError: () => {
      toast.error("Failed to create task");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: Parameters<typeof updateTask>[1] }) =>
      updateTask(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task updated successfully");
    },
    onError: () => {
      toast.error("Failed to update task");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete task");
    },
  });

  const reorderMutation = useMutation({
    mutationFn: reorderTask,
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.error("Failed to reorder task");
    },
  });

  const bulkMutation = useMutation({
    mutationFn: bulkUpdateTasks,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      const op = result.deleted > 0 ? "Deleted" : "Updated";
      const count = result.deleted > 0 ? result.deleted : result.updated;
      toast.success(`${op} ${count} task${count !== 1 ? "s" : ""}`);
      if (result.failed.length > 0) {
        toast.error(`${result.failed.length} task${result.failed.length !== 1 ? "s" : ""} failed to update`);
      }
      setSelectedIds(new Set());
      setSelectionMode(false);
      setActiveBulkAction(null);
    },
    onError: () => {
      toast.error("Bulk operation failed");
    },
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, TaskBoard[]> = {
      todo: [],
      in_progress: [],
      blocked: [],
      done: [],
      cancelled: [],
    };

    if (tasksData?.tasks) {
      for (const task of tasksData.tasks) {
        if (grouped[task.status as TaskStatus]) {
          grouped[task.status as TaskStatus].push(task);
        }
      }
    }

    return grouped;
  }, [tasksData]);

  // Get unique milestones from tasks for the dialog
  const milestones = useMemo(() => {
    const milestoneMap = new Map<string, MilestoneInfo>();
    if (tasksData?.tasks) {
      for (const task of tasksData.tasks) {
        if (task.milestone) {
          milestoneMap.set(task.milestone.id, task.milestone);
        }
      }
    }
    return Array.from(milestoneMap.values());
  }, [tasksData]);

  // Handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasksData?.tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as UniqueIdentifier;

    // Find the task being dragged
    const task = tasksData?.tasks.find((t) => t.id === activeId);
    if (!task) return;

    // Check if dropped on a column or another task
    const isColumnDrop = TASK_STATUSES.some((s) => s.value === overId);

    if (isColumnDrop) {
      const newStatus = overId as TaskStatus;
      if (task.status !== newStatus) {
        reorderMutation.mutate({
          task_id: activeId,
          new_status: newStatus,
          after_task_id: null,
        });
      }
    } else {
      // Dropped on another task - find which column it's in
      const overTask = tasksData?.tasks.find((t) => t.id === overId);
      if (overTask && task.status !== overTask.status) {
        reorderMutation.mutate({
          task_id: activeId,
          new_status: overTask.status,
          after_task_id: String(overId),
        });
      }
    }
  };

  const handleAddTask = (status: TaskStatus) => {
    setEditingTask(null);
    setDefaultStatus(status);
    setDialogOpen(true);
  };

  const handleEditTask = (task: TaskBoard) => {
    setEditingTask(task);
    setDefaultStatus(task.status as TaskStatus);
    setDialogOpen(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (confirm("Are you sure you want to delete this task?")) {
      deleteMutation.mutate(taskId);
    }
  };

  const handleSubmit = async (data: {
    title: string;
    description?: string;
    milestone_id: string;
    status: TaskStatus;
    priority: string;
    due_date?: string;
    assigned_to?: string | null;
    depends_on?: string[];
  }) => {
    if (editingTask) {
      await updateMutation.mutateAsync({
        taskId: editingTask.id,
        data: {
          title: data.title,
          description: data.description,
          status: data.status,
          priority: data.priority as TaskPriority,
          due_date: data.due_date,
          assigned_to: data.assigned_to,
        },
      });
      // Update dependencies separately (validated server-side for cycles)
      if (data.depends_on !== undefined) {
        try {
          await updateTaskDependencies(editingTask.id, data.depends_on);
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to update dependencies";
          toast.error(msg);
        }
      }
    } else {
      await createMutation.mutateAsync({
        title: data.title,
        description: data.description,
        milestone_id: data.milestone_id,
        due_date: data.due_date,
        assigned_to: data.assigned_to ?? undefined,
        priority: data.priority as "low" | "medium" | "high" | "urgent",
      });
    }
  };

  const handleViewDependencies = useCallback((task: TaskBoard) => {
    setGraphFocusTask(task);
    setGraphView(true);
  }, []);

  const handleClearFilters = () => {
    setSelectedProgram(undefined);
    setSelectedAssignee(undefined);
    setSelectedStatus(undefined);
    setOverdueOnly(false);
  };

  // ── Selection handlers ──────────────────────────────────────────────────────

  const handleToggleSelect = useCallback((taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = tasksData?.tasks.map((t) => t.id) ?? [];
    if (selectedIds.size === allIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }, [tasksData, selectedIds.size]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, []);

  const handleToggleSelectionMode = () => {
    if (selectionMode) {
      handleClearSelection();
    } else {
      setSelectionMode(true);
    }
  };

  // ── Bulk action handlers ───────────────────────────────────────────────────

  const selectedTaskIds = Array.from(selectedIds);

  const handleBulkReassign = (assigneeId: string | null) => {
    bulkMutation.mutate({
      task_ids: selectedTaskIds,
      ...(assigneeId ? { assigned_to: assigneeId } : { clear_assignee: true }),
    });
  };

  const handleBulkStatus = (status: TaskStatus) => {
    bulkMutation.mutate({ task_ids: selectedTaskIds, status });
  };

  const handleBulkDueDate = (date: Date | null) => {
    bulkMutation.mutate({
      task_ids: selectedTaskIds,
      ...(date ? { due_date: format(date, "yyyy-MM-dd") } : { clear_due_date: true }),
    });
  };

  const handleBulkDelete = () => {
    bulkMutation.mutate({ task_ids: selectedTaskIds, delete: true });
  };

  if (tasksLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  const totalTaskCount = tasksData?.tasks.length ?? 0;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <TaskFilters
          programs={programs}
          assignees={assignees}
          selectedProgram={selectedProgram}
          selectedAssignee={selectedAssignee}
          selectedStatus={selectedStatus}
          overdueOnly={overdueOnly}
          onProgramChange={setSelectedProgram}
          onAssigneeChange={setSelectedAssignee}
          onStatusChange={setSelectedStatus}
          onOverdueChange={setOverdueOnly}
          onClearFilters={handleClearFilters}
        />
        <div className="flex items-center gap-2">
          <DataTableExport
            visibleRows={tasksData?.tasks ?? []}
            columns={TASK_EXPORT_COLUMNS}
            fileName="tasks"
            exportAllUrl={(() => {
              const params = new URLSearchParams();
              if (selectedProgram) params.set("program_id", selectedProgram);
              if (selectedAssignee) params.set("assignee_id", selectedAssignee);
              if (selectedStatus) params.set("status", selectedStatus);
              const qs = params.toString();
              return `${API_BASE_URL}/api/v1/export/tasks${qs ? `?${qs}` : ""}`;
            })()}
          />
          <Button
            variant={graphView ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setGraphView((v) => !v);
              if (graphView) setGraphFocusTask(null);
            }}
            className="gap-1.5"
          >
            <GitBranch className="size-4" />
            {graphView ? "Board view" : "Dependency graph"}
          </Button>
          <Button
            variant={selectionMode ? "secondary" : "outline"}
            size="sm"
            onClick={handleToggleSelectionMode}
            className="gap-1.5"
          >
            <CheckSquare className="size-4" />
            {selectionMode ? "Cancel selection" : "Select"}
          </Button>
          <Button onClick={() => handleAddTask("todo")} className="gap-1.5">
            <Plus className="size-4" />
            Add Task
          </Button>
        </div>
      </div>

      {graphView ? (
        <div className="rounded-lg border p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Dependency Graph</h3>
              <p className="text-xs text-muted-foreground">
                Arrows show task dependencies (A → B means B depends on A).
                {graphFocusTask && (
                  <span className="ml-1">
                    Focused on: <strong>{graphFocusTask.title}</strong>
                    {" · "}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => setGraphFocusTask(null)}
                    >
                      Clear focus
                    </button>
                  </span>
                )}
              </p>
            </div>
          </div>
          <TaskDependencyGraph
            tasks={tasksData?.tasks ?? []}
            focusTaskId={graphFocusTask?.id ?? null}
            onTaskClick={(task) => {
              setGraphFocusTask(task);
            }}
          />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {TASK_STATUSES.map((status) => (
              <TaskColumn
                key={status.value}
                status={status.value}
                title={status.label}
                color={status.color}
                tasks={tasksByStatus[status.value]}
                allTasks={tasksData?.tasks ?? []}
                onAddTask={handleAddTask}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onViewDependencies={handleViewDependencies}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                selectionMode={selectionMode}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask && (
              <div className="w-64 rounded-lg border bg-card p-3 shadow-lg">
                <h4 className="text-sm font-medium">{activeTask.title}</h4>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Floating selection bar */}
      <TaskSelectionBar
        selectedCount={selectedIds.size}
        totalCount={totalTaskCount}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        onAction={setActiveBulkAction}
        isLoading={bulkMutation.isPending}
      />

      {/* Bulk action dialogs */}
      <ReassignDialog
        open={activeBulkAction === "reassign"}
        onOpenChange={(open) => !open && setActiveBulkAction(null)}
        assignees={assignees}
        selectedCount={selectedIds.size}
        onConfirm={handleBulkReassign}
        isLoading={bulkMutation.isPending}
      />
      <StatusDialog
        open={activeBulkAction === "status"}
        onOpenChange={(open) => !open && setActiveBulkAction(null)}
        selectedCount={selectedIds.size}
        onConfirm={handleBulkStatus}
        isLoading={bulkMutation.isPending}
      />
      <DueDateDialog
        open={activeBulkAction === "due-date"}
        onOpenChange={(open) => !open && setActiveBulkAction(null)}
        selectedCount={selectedIds.size}
        onConfirm={handleBulkDueDate}
        isLoading={bulkMutation.isPending}
      />
      <DeleteDialog
        open={activeBulkAction === "delete"}
        onOpenChange={(open) => !open && setActiveBulkAction(null)}
        selectedCount={selectedIds.size}
        onConfirm={handleBulkDelete}
        isLoading={bulkMutation.isPending}
      />

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        milestones={milestones}
        assignees={assignees}
        defaultStatus={defaultStatus}
        allTasks={tasksData?.tasks ?? []}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
