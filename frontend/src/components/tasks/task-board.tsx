"use client";

import { useState, useMemo } from "react";
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

import { TaskColumn } from "./task-column";
import { TaskFilters } from "./task-filters";
import { TaskDialog } from "./task-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  reorderTask,
  getProgramsForFilter,
  getAssigneesForFilter,
} from "@/lib/api/tasks";
import type {
  TaskBoard,
  TaskStatus,
  TaskPriority,
  MilestoneInfo,
} from "@/types/task";
import { TASK_STATUSES } from "@/types/task";

export function TaskBoard() {
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

  // Drag state
  const [activeTask, setActiveTask] = useState<TaskBoard | null>(null);

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
        if (grouped[task.status]) {
          grouped[task.status].push(task);
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
    setDefaultStatus(task.status);
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

  const handleClearFilters = () => {
    setSelectedProgram(undefined);
    setSelectedAssignee(undefined);
    setSelectedStatus(undefined);
    setOverdueOnly(false);
  };

  if (tasksLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

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
        <Button onClick={() => handleAddTask("todo")} className="gap-1.5">
          <Plus className="size-4" />
          Add Task
        </Button>
      </div>

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
              onAddTask={handleAddTask}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
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

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        milestones={milestones}
        assignees={assignees}
        defaultStatus={defaultStatus}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
