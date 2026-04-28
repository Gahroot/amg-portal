"use client";

import { useState, useMemo, useCallback } from "react";
import {
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

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
import { queryKeys } from "@/lib/query-keys";
import type {
  TaskBoard,
  TaskStatus,
  TaskPriority,
  MilestoneInfo,
} from "@/types/task";
import { TASK_STATUSES } from "@/types/task";
import type { BulkActionType } from "@/components/tasks/bulk-task-actions";

export function useTaskBoard() {
  const queryClient = useQueryClient();

  // Filter state
  const [selectedProgram, setSelectedProgram] = useState<string | undefined>();
  const [selectedAssignee, setSelectedAssignee] = useState<string | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskBoard | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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
  const taskParams = {
    program_id: selectedProgram,
    assignee_id: selectedAssignee,
    status: selectedStatus,
    overdue_only: overdueOnly,
    limit: 500,
  };

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: queryKeys.tasks.list(taskParams),
    queryFn: () => getTasks(taskParams),
  });

  const { data: programs = [] } = useQuery({
    queryKey: queryKeys.tasks.programs(),
    queryFn: getProgramsForFilter,
  });

  const { data: assignees = [] } = useQuery({
    queryKey: queryKeys.tasks.assignees(),
    queryFn: getAssigneesForFilter,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast.success("Task updated successfully");
    },
    onError: () => {
      toast.error("Failed to update task");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast.success("Task deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete task");
    },
  });

  const reorderMutation = useMutation({
    mutationFn: reorderTask,
    onError: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast.error("Failed to reorder task");
    },
  });

  const bulkMutation = useMutation({
    mutationFn: bulkUpdateTasks,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
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
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Derived data
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

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    const task = tasksData?.tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as UniqueIdentifier;
    const task = tasksData?.tasks.find((t) => t.id === activeId);
    if (!task) return;

    const isColumnDrop = TASK_STATUSES.some((s) => s.value === overId);
    if (isColumnDrop) {
      const newStatus = overId as TaskStatus;
      if (task.status !== newStatus) {
        reorderMutation.mutate({ task_id: activeId, new_status: newStatus, after_task_id: null });
      }
    } else {
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

  // Task CRUD handlers
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

  const handleDeleteTask = (taskId: string) => {
    setPendingDeleteId(taskId);
  };

  const handleConfirmDeleteTask = () => {
    if (pendingDeleteId) {
      deleteMutation.mutate(pendingDeleteId);
      setPendingDeleteId(null);
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
      if (data.depends_on !== undefined) {
        try {
          await updateTaskDependencies(editingTask.id, data.depends_on);
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
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

  // Selection handlers
  const handleToggleSelect = useCallback((taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = tasksData?.tasks.map((t) => t.id) ?? [];
    setSelectedIds(selectedIds.size === allIds.length ? new Set() : new Set(allIds));
  }, [tasksData, selectedIds.size]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, []);

  const handleToggleSelectionMode = () => {
    if (selectionMode) handleClearSelection();
    else setSelectionMode(true);
  };

  // Bulk action handlers
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

  return {
    // Data
    tasksData,
    tasksLoading,
    programs,
    assignees,
    milestones,
    tasksByStatus,

    // Filter state
    selectedProgram,
    selectedAssignee,
    selectedStatus,
    overdueOnly,
    setSelectedProgram,
    setSelectedAssignee,
    setSelectedStatus,
    setOverdueOnly,
    handleClearFilters,

    // Dialog state
    dialogOpen,
    setDialogOpen,
    editingTask,
    defaultStatus,
    handleSubmit,

    // DnD
    sensors,
    activeTask,
    handleDragStart,
    handleDragEnd,

    // Task actions
    handleAddTask,
    handleEditTask,
    handleDeleteTask,
    pendingDeleteId,
    setPendingDeleteId,
    handleConfirmDeleteTask,
    handleViewDependencies,

    // Selection
    selectionMode,
    selectedIds,
    activeBulkAction,
    setActiveBulkAction,
    handleToggleSelect,
    handleSelectAll,
    handleClearSelection,
    handleToggleSelectionMode,
    bulkMutationPending: bulkMutation.isPending,

    // Bulk actions
    handleBulkReassign,
    handleBulkStatus,
    handleBulkDueDate,
    handleBulkDelete,

    // Graph view
    graphView,
    setGraphView,
    graphFocusTask,
    setGraphFocusTask,
  };
}
