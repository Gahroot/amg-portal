"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import {
  updateTask,
  createMilestone,
} from "@/lib/api/programs";
import { useProgram } from "@/hooks/use-programs";
import { useProgramApprovals } from "@/hooks/use-approvals";
import type { TaskStatus, MilestoneCreate } from "@/types/program";
import { useSecurityBrief } from "@/hooks/use-clients";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/programs/status-badge";
import { RagBadge } from "@/components/programs/rag-badge";
import { ApprovalDialog } from "@/components/programs/approval-dialog";
import { EmergencyActivationDialog } from "@/components/programs/emergency-activation-dialog";
import { DocumentList } from "@/components/documents/document-list";
import { BookmarkButton } from "@/components/ui/bookmark-button";
import { GanttChart } from "@/components/programs/gantt-chart";
import { GanttToolbar } from "@/components/programs/gantt-toolbar";
import type { ZoomLevel, GanttFilters } from "@/components/programs/gantt-toolbar";
import { useProgramGantt } from "@/hooks/use-program-gantt";
import { TravelLogisticsTab } from "@/components/travel/travel-logistics-tab";
import { AlertTriangle, Clock } from "lucide-react";

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

  const { data: program, isLoading } = useProgram(programId);

  const { data: approvals } = useProgramApprovals(programId);

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      updateTask(taskId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs", programId] });
    },
  });

  const [milestoneOpen, setMilestoneOpen] = React.useState(false);
  const [newMilestone, setNewMilestone] = React.useState<MilestoneCreate>({
    title: "",
    description: "",
    due_date: "",
  });

  // Gantt state
  const ganttData = useProgramGantt(program);
  const [ganttZoom, setGanttZoom] = React.useState<ZoomLevel>("week");
  const [ganttFilters, setGanttFilters] = React.useState<GanttFilters>({
    hideCompleted: false,
    showOnlyCritical: false,
    hideTasks: false,
  });
  const [isExporting, setIsExporting] = React.useState(false);
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  const handleGanttExport = React.useCallback(async () => {
    if (!svgRef.current) return;
    setIsExporting(true);
    try {
      const svg = svgRef.current;
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = 2;
        canvas.width = svg.width.baseVal.value * scale;
        canvas.height = svg.height.baseVal.value * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(scale, scale);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `${program?.title ?? "program"}-gantt.png`;
          link.click();
          setIsExporting(false);
        }, "image/png");
      };
      img.onerror = () => { URL.revokeObjectURL(url); setIsExporting(false); };
      img.src = url;
    } catch {
      setIsExporting(false);
    }
  }, [program?.title]);

  const createMilestoneMutation = useMutation({
    mutationFn: (data: MilestoneCreate) => createMilestone(programId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs", programId] });
      setMilestoneOpen(false);
      setNewMilestone({ title: "", description: "", due_date: "" });
    },
  });

  const [activeTab, setActiveTab] = React.useState("overview");

  // Tick every 30 s so the retrospective countdown stays fresh without impure
  // Date.now() calls inline during render.
  const [nowMs, setNowMs] = React.useState(0);
  React.useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const canApprove =
    user?.role === "managing_director" ||
    user?.role === "relationship_manager";

  const isMD = user?.role === "managing_director";
  const isInternalSenior = canApprove;

  // Security brief — only fetched for MD/RM when we have a client_id
  // The query is enabled lazily once program data is available.
  const clientId = program?.client_id?.toString() ?? "";
  const { data: securityBrief } = useSecurityBrief(
    clientId,
    isInternalSenior && !!clientId
  );

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

  // --- Emergency activation derived state ---
  const hasPendingApproval = approvals?.some((a) => a.status === "pending");

  const showEmergencyButton =
    isMD &&
    program.status === "design" &&
    hasPendingApproval &&
    program.milestone_count > 0;

  const retrospectiveDue = program.retrospective_due_at
    ? new Date(program.retrospective_due_at)
    : null;

  const showRetrospectiveBanner =
    program.status === "active" &&
    retrospectiveDue !== null &&
    retrospectiveDue.getTime() > nowMs;

  const retrospectiveTimeLeft = retrospectiveDue
    ? (() => {
        const msLeft = retrospectiveDue.getTime() - nowMs;
        if (msLeft <= 0) return null;
        const h = Math.floor(msLeft / 3_600_000);
        const m = Math.floor((msLeft % 3_600_000) / 60_000);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
      })()
    : null;

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Retrospective-due banner */}
        {showRetrospectiveBanner && (
          <Alert variant="destructive">
            <Clock className="h-4 w-4" />
            <AlertTitle>Emergency Activation — Retrospective Required</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>
                This program was emergency-activated. A formal retrospective
                record must be completed
                {retrospectiveTimeLeft
                  ? ` within ${retrospectiveTimeLeft}`
                  : ` by ${retrospectiveDue?.toLocaleTimeString()}`}
                . Reason recorded:{" "}
                <em>{program.emergency_reason}</em>
              </span>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setActiveTab("approvals")}
              >
                Complete Retrospective
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              {program.title}
            </h1>
            <BookmarkButton
              entityType="program"
              entityId={programId}
              entityTitle={program.title}
              entitySubtitle={program.client_name}
            />
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={program.status} />
            <RagBadge status={program.rag_status} />
            {showEmergencyButton && (
              <EmergencyActivationDialog
                programId={programId}
                trigger={
                  <Button variant="destructive" size="sm" className="gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    Emergency Activate
                  </Button>
                }
              />
            )}
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="travel">Travel</TabsTrigger>
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

            {/* Security Considerations — MD/RM only, executive-level clients */}
            {isInternalSenior && securityBrief && (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardHeader>
                  <CardTitle className="font-serif text-xl text-amber-900">
                    Security Considerations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                    <AlertDescription className="text-xs font-medium">
                      Security information is strictly need-to-know. This data
                      is not visible to the client or partner portal.
                    </AlertDescription>
                  </Alert>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Threat level:
                    </span>
                    <Badge
                      variant={
                        securityBrief.threat_summary.threat_level === "high" ||
                        securityBrief.threat_summary.threat_level === "critical"
                          ? "destructive"
                          : securityBrief.threat_summary.threat_level === "medium"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {securityBrief.threat_summary.threat_level.toUpperCase()}
                    </Badge>
                    <Badge variant={securityBrief.feed_connected ? "default" : "outline"}>
                      {securityBrief.feed_connected ? "Feed: Live" : "Feed: Offline"}
                    </Badge>
                  </div>

                  {securityBrief.threat_summary.note && (
                    <p className="text-xs text-muted-foreground italic">
                      {securityBrief.threat_summary.note}
                    </p>
                  )}

                  {securityBrief.travel_advisories.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-amber-900">
                          Travel Advisories
                        </p>
                        {securityBrief.travel_advisories.map((adv) => (
                          <div
                            key={adv.destination}
                            className="flex items-center justify-between rounded border border-amber-200 bg-white px-3 py-2 text-sm"
                          >
                            <span className="font-medium">{adv.destination}</span>
                            <Badge
                              variant={
                                adv.risk_level === "high" ||
                                adv.risk_level === "extreme"
                                  ? "destructive"
                                  : adv.risk_level === "medium"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {adv.risk_level}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <p className="text-xs text-muted-foreground">
                    ✓ Access logged · View full brief on the client profile
                  </p>
                </CardContent>
              </Card>
            )}
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

          <TabsContent value="timeline" className="space-y-4">
            <GanttToolbar
              zoom={ganttZoom}
              onZoomChange={setGanttZoom}
              filters={ganttFilters}
              onFiltersChange={setGanttFilters}
              onExport={handleGanttExport}
              isExporting={isExporting}
            />
            <GanttChart
              items={ganttData.items}
              dependencies={ganttData.dependencies}
              projectStart={ganttData.projectStart}
              projectEnd={ganttData.projectEnd}
              zoom={ganttZoom}
              filters={ganttFilters}
              svgRef={svgRef}
            />
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

          <TabsContent value="documents" className="space-y-4">
            <DocumentList entityType="program" entityId={programId} />
          </TabsContent>

          <TabsContent value="travel" className="space-y-4">
            <TravelLogisticsTab programId={programId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
