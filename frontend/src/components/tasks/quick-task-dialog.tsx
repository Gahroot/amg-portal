"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_PRIORITIES } from "@/types/task";
import {
  useTaskPrograms,
  useTaskAssignees,
  useTaskMilestones,
} from "@/hooks/use-tasks";
import { createTask } from "@/lib/api/tasks";
import { useAuth } from "@/providers/auth-provider";

const quickTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title must be 255 characters or less"),
  description: z.string().max(2000).optional(),
  program_id: z.string().min(1, "Program is required"),
  milestone_id: z.string().min(1, "Milestone is required"),
  due_date: z.string().optional(),
  assigned_to: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
});

type QuickTaskFormData = z.infer<typeof quickTaskSchema>;

interface QuickTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select a program when dialog opens (e.g. inferred from current page) */
  defaultProgramId?: string | null;
}

export function QuickTaskDialog({
  open,
  onOpenChange,
  defaultProgramId,
}: QuickTaskDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: programs = [] } = useTaskPrograms();
  const { data: assignees = [] } = useTaskAssignees();

  // Track selected program in local state to avoid form.watch() React Compiler warning
  const [selectedProgramId, setSelectedProgramId] = useState<string>(
    defaultProgramId ?? "",
  );
  const { data: milestones = [] } = useTaskMilestones(selectedProgramId || null);

  const form = useForm<QuickTaskFormData>({
    resolver: zodResolver(quickTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      program_id: defaultProgramId ?? "",
      milestone_id: "",
      due_date: "",
      assigned_to: user?.id ?? null,
      priority: "medium",
    },
  });

  // Sync selectedProgramId with defaultProgramId when it changes between opens
  // Using a stable reference comparison so this only runs on real changes
  const [lastDefaultProgramId, setLastDefaultProgramId] = useState(defaultProgramId);
  if (defaultProgramId !== lastDefaultProgramId) {
    setLastDefaultProgramId(defaultProgramId);
    setSelectedProgramId(defaultProgramId ?? "");
    form.setValue("program_id", defaultProgramId ?? "");
    form.setValue("milestone_id", "");
  }

  // Auto-select first milestone when milestones load for the selected program
  useEffect(() => {
    if (milestones.length > 0 && !form.getValues("milestone_id")) {
      form.setValue("milestone_id", milestones[0].id);
    }
  }, [milestones, form]);

  function handleProgramChange(programId: string) {
    setSelectedProgramId(programId);
    form.setValue("program_id", programId);
    form.setValue("milestone_id", "");
  }

  async function handleSubmit(data: QuickTaskFormData) {
    try {
      await createTask({
        title: data.title,
        description: data.description || undefined,
        milestone_id: data.milestone_id,
        due_date: data.due_date || undefined,
        assigned_to: data.assigned_to || undefined,
        priority: data.priority,
      });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task created successfully");
      onOpenChange(false);
    } catch {
      toast.error("Failed to create task");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
          <DialogDescription>
            Create a task quickly. Press{" "}
            <kbd className="rounded border bg-muted px-1 py-0.5 text-xs font-mono">T</kbd>{" "}
            anywhere to open this dialog.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="What needs to be done?" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Program + Milestone */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="program_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Program</FormLabel>
                    <Select
                      onValueChange={(v) => {
                        field.onChange(v);
                        handleProgramChange(v);
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select program" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {programs.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="milestone_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Milestone</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!selectedProgramId || milestones.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              !selectedProgramId
                                ? "Select program first"
                                : milestones.length === 0
                                  ? "No milestones"
                                  : "Select milestone"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {milestones.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Due date + Priority */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TASK_PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Assignee */}
            <FormField
              control={form.control}
              name="assigned_to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assignee</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === "unassigned" ? null : v)}
                    value={field.value ?? "unassigned"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {assignees.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Description{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add more details…"
                      rows={2}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Creating…" : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
