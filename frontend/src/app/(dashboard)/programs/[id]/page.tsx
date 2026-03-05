"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import {
  getProgram,
  updateTask,
  createMilestone,
} from "@/lib/api/programs";
import type { TaskStatus, MilestoneCreate } from "@/lib/api/programs";
import { getProgramApprovals } from "@/lib/api/approvals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/programs/status-badge";
import { RagBadge } from "@/components/programs/rag-badge";
import { ApprovalDialog } from "@/components/programs/approval-dialog";

const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  urgent: "destructive",
};

export default function ProgramDashboardPage() {
  const params = useParams();
  const programId = params.id as string;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: program, isLoading } = useQuery({
    queryKey: ["program", programId],
    queryFn: () => getProgram(programId),
  });

  const { data: approvals } = useQuery({
    queryKey: ["program-approvals", programId],
    queryFn: () => getProgramApprovals(programId),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      updateTask(taskId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program", programId] });
    },
  });

  const [milestoneOpen, setMilestoneOpen] = React.useState(false);
  const [newMilestone, setNewMilestone] = React.useState<MilestoneCreate>({
    title: "",
    description: "",
    due_date: "",
  });

  const createMilestoneMutation = useMutation({
    mutationFn: (data: MilestoneCreate) => createMilestone(programId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program", programId] });
      setMilestoneOpen(false);
      setNewMilestone({ title: "", description: "", due_date: "" });
    },
  });

  const canApprove =
    user?.role === "managing_director" ||
    user?.role === "relationship_manager";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground text-sm">Loading program...</p>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground">Program not found.</p>
        </div>
      </div>
    );
  }

  const allTasks = program.milestones.flatMap((m) =>
    m.tasks.map((t) => ({ ...t, milestone_title: m.title }))
  );

  const milestoneProgress = (milestone: (typeof program.milestones)[0]) => {
    if (milestone.tasks.length === 0) return 0;
    const completed = milestone.tasks.filter(
      (t) => t.status === "done"
    ).length;
    return Math.round((completed / milestone.tasks.length) * 100);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            {program.title}
          </h1>
          <div className="flex items-center gap-2">
            <StatusBadge status={program.status} />
            <RagBadge status={program.rag_status} />
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={program.status} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">RAG</p>
                  <div className="mt-1">
                    <RagBadge status={program.rag_status} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="font-medium">
                    {program.start_date
                      ? new Date(program.start_date).toLocaleDateString()
                      : "-"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">End Date</p>
                  <p className="font-medium">
                    {program.end_date
                      ? new Date(program.end_date).toLocaleDateString()
                      : "-"}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Budget</p>
                  <p className="font-medium">
                    {program.budget_envelope != null
                      ? `$${program.budget_envelope.toLocaleString()}`
                      : "Not set"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">
                    Milestone Progress
                  </p>
                  <p className="font-medium">
                    {program.completed_milestone_count} /{" "}
                    {program.milestone_count} completed
                  </p>
                  <Progress
                    value={
                      program.milestone_count > 0
                        ? (program.completed_milestone_count /
                            program.milestone_count) *
                          100
                        : 0
                    }
                    className="mt-2"
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="milestones" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={milestoneOpen} onOpenChange={setMilestoneOpen}>
                <DialogTrigger asChild>
                  <Button>Add Milestone</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Milestone</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={newMilestone.title}
                        onChange={(e) =>
                          setNewMilestone((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        value={newMilestone.description ?? ""}
                        onChange={(e) =>
                          setNewMilestone((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Due Date</Label>
                      <Input
                        type="date"
                        value={newMilestone.due_date ?? ""}
                        onChange={(e) =>
                          setNewMilestone((prev) => ({
                            ...prev,
                            due_date: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() =>
                        createMilestoneMutation.mutate({
                          title: newMilestone.title,
                          description: newMilestone.description || undefined,
                          due_date: newMilestone.due_date || undefined,
                          position: program.milestones.length,
                        })
                      }
                      disabled={
                        !newMilestone.title ||
                        createMilestoneMutation.isPending
                      }
                    >
                      {createMilestoneMutation.isPending
                        ? "Adding..."
                        : "Add"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {program.milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No milestones yet.
              </p>
            ) : (
              program.milestones.map((milestone) => (
                <Card key={milestone.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {milestone.title}
                      </CardTitle>
                      <StatusBadge status={milestone.status} />
                    </div>
                    {milestone.description && (
                      <p className="text-sm text-muted-foreground">
                        {milestone.description}
                      </p>
                    )}
                    {milestone.due_date && (
                      <p className="text-xs text-muted-foreground">
                        Due:{" "}
                        {new Date(milestone.due_date).toLocaleDateString()}
                      </p>
                    )}
                    <Progress
                      value={milestoneProgress(milestone)}
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      {milestoneProgress(milestone)}% tasks complete
                    </p>
                  </CardHeader>
                  {milestone.tasks.length > 0 && (
                    <CardContent>
                      <Accordion type="single" collapsible>
                        <AccordionItem value="tasks">
                          <AccordionTrigger>
                            Tasks ({milestone.tasks.length})
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2">
                              {milestone.tasks.map((task) => (
                                <div
                                  key={task.id}
                                  className="flex items-center justify-between rounded-md border p-2"
                                >
                                  <div>
                                    <p className="text-sm font-medium">
                                      {task.title}
                                    </p>
                                    <div className="flex gap-2 mt-1">
                                      <StatusBadge status={task.status} />
                                      <Badge
                                        variant={
                                          PRIORITY_VARIANT[task.priority] ??
                                          "outline"
                                        }
                                      >
                                        {task.priority}
                                      </Badge>
                                    </div>
                                  </div>
                                  {task.due_date && (
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(
                                        task.due_date
                                      ).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            <div className="rounded-md border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Milestone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Assigned To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">
                        {task.title}
                      </TableCell>
                      <TableCell>{task.milestone_title}</TableCell>
                      <TableCell>
                        <Select
                          value={task.status}
                          onValueChange={(val) =>
                            updateTaskMutation.mutate({
                              taskId: task.id,
                              status: val as TaskStatus,
                            })
                          }
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TASK_STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            PRIORITY_VARIANT[task.priority] ?? "outline"
                          }
                        >
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {task.due_date
                          ? new Date(task.due_date).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {task.assigned_to_name ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {allTasks.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground"
                      >
                        No tasks found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="approvals" className="space-y-4">
            {approvals && approvals.length > 0 ? (
              approvals.map((approval) => (
                <Card key={approval.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          Requested by {approval.requester_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(
                            approval.created_at
                          ).toLocaleDateString()}
                        </p>
                        <StatusBadge status={approval.status} />
                        {approval.comments && (
                          <p className="text-sm mt-1">
                            {approval.comments}
                          </p>
                        )}
                        {approval.approver_name && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Decided by {approval.approver_name}
                          </p>
                        )}
                      </div>
                      {canApprove && approval.status === "pending" && (
                        <div className="flex gap-2">
                          <ApprovalDialog
                            approvalId={approval.id}
                            programId={programId}
                            action="approved"
                            trigger={
                              <Button size="sm">Approve</Button>
                            }
                          />
                          <ApprovalDialog
                            approvalId={approval.id}
                            programId={programId}
                            action="rejected"
                            trigger={
                              <Button size="sm" variant="destructive">
                                Reject
                              </Button>
                            }
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No approval records.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
