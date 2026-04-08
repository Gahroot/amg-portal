"use client";

import { use, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { getTask } from "@/lib/api/tasks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { ArrowLeft, Calendar, User, Flag, Milestone as MilestoneIcon } from "lucide-react";
import { toast } from "sonner";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/types/task";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  todo: "outline",
  in_progress: "default",
  blocked: "destructive",
  done: "secondary",
  cancelled: "secondary",
};

const PRIORITY_COLOR: Record<string, string> = {
  low: "text-slate-500 border-slate-300",
  medium: "text-blue-600 border-blue-300",
  high: "text-orange-600 border-orange-300",
  urgent: "text-red-600 border-red-300",
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "--";
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function statusLabel(value: string): string {
  return TASK_STATUSES.find((s) => s.value === value)?.label ?? value;
}

function priorityLabel(value: string): string {
  return TASK_PRIORITIES.find((p) => p.value === value)?.label ?? value;
}

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();

  const { data: task, isLoading, isError } = useQuery({
    queryKey: ["tasks", id],
    queryFn: () => getTask(id),
    enabled: !!user,
  });

  useEffect(() => {
    if (isError) {
      toast.error("Failed to load task");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading task...</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Task not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/tasks">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tasks
          </Link>
        </Button>

<h1 className="font-serif text-2xl font-bold tracking-tight">
          {task.title}
        </h1>

<div className="flex items-center gap-3 flex-wrap">
          <Badge variant={STATUS_VARIANT[task.status] ?? "outline"}>
            {statusLabel(task.status)}
          </Badge>
          <Badge
            variant="outline"
            className={PRIORITY_COLOR[task.priority] ?? ""}
          >
            <Flag className="mr-1 h-3 w-3" />
            {priorityLabel(task.priority)}
          </Badge>
        </div>

<Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {task.description && (
              <>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {task.description}
                </p>
                <Separator />
              </>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
<div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Due Date</span>
                <span className="ml-auto font-medium">
                  {formatDate(task.due_date)}
                </span>
              </div>

<div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Assignee</span>
                <span className="ml-auto font-medium">
                  {task.assignee
                    ? `${task.assignee.name} (${task.assignee.email})`
                    : "Unassigned"}
                </span>
              </div>

<div className="flex items-center gap-2">
                <MilestoneIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Program</span>
                <span className="ml-auto font-medium">
                  {task.program ? (
                    <Link
                      href={`/programs/${task.program.id}`}
                      className="underline hover:text-primary"
                    >
                      {task.program.title}
                    </Link>
                  ) : (
                    "--"
                  )}
                </span>
              </div>

<div className="flex items-center gap-2">
                <MilestoneIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Milestone</span>
                <span className="ml-auto font-medium">
                  {task.milestone?.title ?? "--"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
