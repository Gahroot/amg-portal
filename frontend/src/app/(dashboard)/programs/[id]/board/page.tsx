"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useProgram } from "@/hooks/use-programs";
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
import { toast } from "sonner";

import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  reorderTask,
  getAssigneesForFilter,
} from "@/lib/api/tasks";
import type { TaskBoard, TaskStatus, TaskPriority, MilestoneInfo } from "@/types/task";
import { TASK_STATUSES } from "@/types/task";
import { TaskColumn } from "@/components/tasks/task-column";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Plus } from "lucide-react";

export default function ProgramBoardPage() {
  const params = useParams();
  const router = useRouter();
  const programId = params.id as string;
  const queryClient = useQueryClient();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskBoard | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Drag state
  const [activeTask, setActiveTask] = useState<TaskBoard | null>(null);

  const { data: program, isLoading: programLoading } = useProgram(programId);

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks", programId],
    queryFn: () => getTasks({ program_id: programId, limit: 500 }),
  });

  const { data: assignees = [] } = useQuery({
    queryKey: ["task-assignees"],
    queryFn: getAssigneesForFilter,
  });

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", programId] });
      toast.success("Task created successfully");
    },
    onError: () => toast.error("Failed to create task"),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      taskId,
      data,
    }: {
      taskId: string;
      data: Parameters<typeof updateTask>[1];
    }) => updateTask(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", programId] });
      toast.success("Task updated successfully");
    },
    onError: () => toast.error("Failed to update task"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", programId] });
      toast.success("Task deleted successfully");
    },
    onError: () => toast.error("Failed to delete task"),
  });

  const reorderMutation = useMutation({
    mutationFn: reorderTask,
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", programId] });
      toast.error("Failed to reorder task");
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
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

  // Collect unique milestones from tasks for the dialog
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
        reorderMutation.mutate({
          task_id: activeId,
          new_status: newStatus,
          after_task_id: null,
        });
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

  if (programLoading || tasksLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading board...</p>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Program not found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-1 -ml-2"
            onClick={() => router.push(`/programs/${programId}`)}
          >
            ← Back to program
          </Button>
          <h1 className="font-serif text-2xl font-bold tracking-tight">
            {program.title} — Task Board
          </h1>
          <p className="text-sm text-muted-foreground">
            {tasksData?.tasks.length ?? 0} task
            {tasksData?.tasks.length !== 1 ? "s" : ""} across{" "}
            {program.milestone_count} milestone
            {program.milestone_count !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => handleAddTask("todo")} className="gap-1.5">
          <Plus className="size-4" />
          Add Task
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex h-full gap-4 overflow-x-auto pb-4">
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
      </div>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        milestones={milestones}
        assignees={assignees}
        defaultStatus={defaultStatus}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Delete task?"
        description="This will permanently delete the task and cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDeleteId) {
            deleteMutation.mutate(pendingDeleteId);
            setPendingDeleteId(null);
          }
        }}
      />
    </div>
  );
}
