"use client";

import * as React from "react";
import Link from "next/link";
import {
  differenceInHours,
  differenceInDays,
  isPast,
  isToday,
  isTomorrow,
  format,
} from "date-fns";
import {
  usePartnerProfile,
  usePartnerAssignments,
  usePartnerDeliverables,
  usePartnerConversations,
  useMyPerformanceNotices,
  useCapabilityRefreshStatus,
} from "@/hooks/use-partner-portal";
import { useQuery } from "@tanstack/react-query";
import { getMyTrends } from "@/lib/api/partners";
import type { PartnerTrends } from "@/types/partner";
import { PerformanceChart } from "@/components/partners/performance-chart";
import { PerformanceAlerts } from "@/components/partner/performance-alerts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ClipboardList,
  PackageCheck,
  MessageSquare,
  FileText,
  ArrowRight,
  Clock,
  AlertCircle,
  Bell,
  RefreshCw,
  CheckCircle2,
  Timer,
  Layers,
  TrendingUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Assignment } from "@/lib/api/assignments";
import type { DeliverableItem } from "@/types/deliverable";

// ─── SLA Countdown Component ──────────────────────────────────────────────────

interface SLACountdownProps {
  dueDate: string;
  compact?: boolean;
}

function SLACountdown({ dueDate, compact = false }: SLACountdownProps) {
  const [, forceUpdate] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    const id = setInterval(forceUpdate, 60_000);
    return () => clearInterval(id);
  }, []);

  const due = new Date(dueDate);
  const now = new Date();
  const overdue = isPast(due);
  const hoursLeft = differenceInHours(due, now);
  const daysLeft = differenceInDays(due, now);

  if (overdue) {
    const hoursOver = Math.abs(differenceInHours(now, due));
    const daysOver = Math.abs(differenceInDays(now, due));
    const label =
      daysOver >= 1 ? `${daysOver}d overdue` : `${hoursOver}h overdue`;
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
        <Timer className="h-3 w-3" />
        {label}
      </span>
    );
  }

  let label: string;
  let colorClass: string;

  if (isToday(due)) {
    label = `${hoursLeft}h left`;
    colorClass = "text-red-600";
  } else if (isTomorrow(due)) {
    label = compact ? "Tomorrow" : `Tomorrow (${hoursLeft}h)`;
    colorClass = "text-amber-600";
  } else if (daysLeft <= 3) {
    label = `${daysLeft}d left`;
    colorClass = "text-amber-600";
  } else {
    label = format(due, "MMM d");
    colorClass = "text-muted-foreground";
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${colorClass}`}>
      <Clock className="h-3 w-3" />
      {label}
    </span>
  );
}

// ─── Assignment Status Badge ──────────────────────────────────────────────────

const ASSIGNMENT_STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  dispatched: { label: "New", variant: "secondary" },
  accepted: { label: "Accepted", variant: "default" },
  in_progress: { label: "In Progress", variant: "default" },
  completed: { label: "Completed", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "outline" },
};

function AssignmentStatusBadge({ status }: { status: string }) {
  const cfg = ASSIGNMENT_STATUS[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// ─── Deliverable Status Badge ─────────────────────────────────────────────────

const DELIVERABLE_STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Pending", variant: "outline" },
  submitted: { label: "Submitted", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  returned: { label: "Returned", variant: "destructive" },
  rejected: { label: "Rejected", variant: "destructive" },
};

function DeliverableStatusBadge({ status }: { status: string }) {
  const cfg = DELIVERABLE_STATUS[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// ─── Active Assignment Card ───────────────────────────────────────────────────

function ActiveAssignmentCard({ assignment }: { assignment: Assignment }) {
  const isInProgress = assignment.status === "in_progress";
  const dueSoon =
    assignment.due_date && differenceInDays(new Date(assignment.due_date), new Date()) <= 2;
  const overdue = assignment.due_date && isPast(new Date(assignment.due_date));

  return (
    <Card
      className={
        overdue
          ? "border-l-4 border-l-red-500"
          : dueSoon
          ? "border-l-4 border-l-amber-400"
          : undefined
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-tight line-clamp-2">
            {assignment.title}
          </CardTitle>
          <AssignmentStatusBadge status={assignment.status} />
        </div>
        {assignment.program_title && (
          <CardDescription className="text-xs">
            {assignment.program_title}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="pb-2">
        {assignment.brief && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {assignment.brief}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {assignment.due_date ? (
            <SLACountdown dueDate={assignment.due_date} />
          ) : (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              No due date
            </span>
          )}
          {assignment.accepted_at && (
            <span className="text-muted-foreground">
              Accepted {format(new Date(assignment.accepted_at), "MMM d")}
            </span>
          )}
          {isInProgress && (
            <Badge variant="secondary" className="text-xs py-0">
              Active
            </Badge>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-2">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
          <Link href={`/partner/assignments/${assignment.id}`}>
            View details <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

// ─── Deliverable Row ──────────────────────────────────────────────────────────

function DeliverableRow({ deliverable }: { deliverable: DeliverableItem }) {
  return (
    <Link
      href={`/partner/deliverables/${deliverable.id}`}
      className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{deliverable.title}</p>
        <p className="text-xs text-muted-foreground capitalize">
          {deliverable.deliverable_type.replace(/_/g, " ")}
          {deliverable.review_comments && (
            <span className="ml-2 text-amber-600">· Feedback available</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        {deliverable.due_date && deliverable.status === "pending" && (
          <SLACountdown dueDate={deliverable.due_date} compact />
        )}
        <DeliverableStatusBadge status={deliverable.status} />
      </div>
    </Link>
  );
}

// ─── Deliverable Status Summary ───────────────────────────────────────────────

interface DeliverableStatusSummaryProps {
  deliverables: DeliverableItem[];
}

function DeliverableStatusSummary({ deliverables }: DeliverableStatusSummaryProps) {
  const counts = deliverables.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {});

  const entries = (
    ["pending", "submitted", "approved", "returned", "rejected"] as const
  ).filter((s) => (counts[s] ?? 0) > 0);

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {entries.map((status) => (
        <div key={status} className="flex items-center gap-1.5">
          <DeliverableStatusBadge status={status} />
          <span className="text-xs text-muted-foreground font-medium">{counts[status]}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PartnerDashboardPage() {
  const { data: profile, isLoading: profileLoading } = usePartnerProfile();
  const { data: assignmentsData, isLoading: assignmentsLoading } = usePartnerAssignments();
  const { data: deliverablesData, isLoading: deliverablesLoading } = usePartnerDeliverables();
  const { data: conversationsData, isLoading: conversationsLoading } =
    usePartnerConversations();
  const { data: noticesData } = useMyPerformanceNotices();
  const { data: refreshStatus } = useCapabilityRefreshStatus();

  const isLoading =
    profileLoading || assignmentsLoading || deliverablesLoading || conversationsLoading;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-8 w-10" />
                  </div>
                  <Skeleton className="h-9 w-9 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-36" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const assignments = assignmentsData?.assignments ?? [];
  const deliverables = deliverablesData?.deliverables ?? [];

  const newAssignments = assignments.filter((a) => a.status === "dispatched").length;
  const activeAssignments = assignments.filter(
    (a) => a.status === "accepted" || a.status === "in_progress"
  );
  const completedAssignments = assignments.filter((a) => a.status === "completed").length;

  const pendingDeliverables = deliverables.filter(
    (d) => d.status === "pending" || d.status === "returned"
  ).length;
  const totalUnread =
    conversationsData?.conversations.reduce((sum, c) => sum + c.unread_count, 0) ?? 0;
  const unacknowledgedNotices = noticesData?.unacknowledged_count ?? 0;

  // Active assignments sorted: overdue first, then by due date
  const sortedActiveAssignments = [...activeAssignments].sort((a, b) => {
    const aOverdue = a.due_date ? isPast(new Date(a.due_date)) : false;
    const bOverdue = b.due_date ? isPast(new Date(b.due_date)) : false;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    if (a.due_date && b.due_date)
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  // Deliverables: pending/returned first, then submitted, then approved
  const prioritisedDeliverables = [
    ...deliverables.filter((d) => d.status === "pending" || d.status === "returned"),
    ...deliverables.filter((d) => d.status === "submitted"),
    ...deliverables.filter((d) => d.status === "approved"),
  ].slice(0, 6);

  const overdueAssignments = activeAssignments.filter(
    (a) => a.due_date && isPast(new Date(a.due_date))
  ).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* ── Welcome Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Welcome, {profile?.firm_name ?? "Partner"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your assignments, deliverables, and communications
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {newAssignments > 0 && (
            <Badge variant="destructive" className="text-sm py-1 px-3 shrink-0">
              {newAssignments} new {newAssignments === 1 ? "assignment" : "assignments"} awaiting
              response
            </Badge>
          )}
          {overdueAssignments > 0 && (
            <Badge variant="destructive" className="text-sm py-1 px-3 shrink-0">
              <Timer className="mr-1 h-3.5 w-3.5" />
              {overdueAssignments} overdue
            </Badge>
          )}
        </div>
      </div>

      {/* ── Performance Notice Banner ── */}
      {unacknowledgedNotices > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-red-300 bg-red-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-full bg-red-100 p-1.5">
              <Bell className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="font-medium text-red-900">
                {unacknowledgedNotices} unacknowledged performance notice
                {unacknowledgedNotices !== 1 ? "s" : ""}
              </p>
              <p className="text-sm text-red-700">
                Formal notices from the Managing Director require your acknowledgement.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="destructive" className="shrink-0">
            <Link href="/partner/notices">
              View Notices <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      {/* ── Capability Refresh Banner ── */}
      {refreshStatus && (refreshStatus.is_overdue || refreshStatus.is_due_soon) && (
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
            refreshStatus.is_overdue
              ? "border-red-300 bg-red-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`shrink-0 rounded-full p-1.5 ${
                refreshStatus.is_overdue ? "bg-red-100" : "bg-amber-100"
              }`}
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  refreshStatus.is_overdue ? "text-red-600" : "text-amber-600"
                }`}
              />
            </div>
            <div>
              <p
                className={`font-medium ${
                  refreshStatus.is_overdue ? "text-red-900" : "text-amber-900"
                }`}
              >
                {refreshStatus.is_overdue
                  ? "Annual capability refresh overdue"
                  : `Annual capability refresh due in ${refreshStatus.days_until_due} day${refreshStatus.days_until_due !== 1 ? "s" : ""}`}
              </p>
              <p
                className={`text-sm ${
                  refreshStatus.is_overdue ? "text-red-700" : "text-amber-700"
                }`}
              >
                Confirm your current accreditations, insurance, and capacity to remain active.
              </p>
            </div>
          </div>
          <Button
            asChild
            size="sm"
            variant={refreshStatus.is_overdue ? "destructive" : "outline"}
            className="shrink-0"
          >
            <Link href="/partner/capability-refresh">
              Complete Refresh <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/partner/inbox">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">New</p>
                  <p className="text-2xl font-bold mt-0.5">{newAssignments}</p>
                  <p className="text-xs text-muted-foreground">assignments</p>
                </div>
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/partner/assignments">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Active</p>
                  <p className="text-2xl font-bold mt-0.5">{activeAssignments.length}</p>
                  <p className="text-xs text-muted-foreground">in progress</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/partner/deliverables">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Deliverables
                  </p>
                  <p className="text-2xl font-bold mt-0.5">{pendingDeliverables}</p>
                  <p className="text-xs text-muted-foreground">need action</p>
                </div>
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <PackageCheck className="h-5 w-5 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/partner/messages">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Messages</p>
                  <p className="text-2xl font-bold mt-0.5">{totalUnread}</p>
                  <p className="text-xs text-muted-foreground">unread</p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ── Active Assignments ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Active Assignments</CardTitle>
              {activeAssignments.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeAssignments.length}
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/partner/assignments">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          {overdueAssignments > 0 && (
            <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
              <AlertCircle className="h-3.5 w-3.5" />
              {overdueAssignments} assignment{overdueAssignments !== 1 ? "s" : ""} past due date
            </p>
          )}
        </CardHeader>

        <CardContent>
          {sortedActiveAssignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No active assignments</p>
              <p className="text-xs text-muted-foreground mt-1">
                New assignments will appear here once accepted
              </p>
              {newAssignments > 0 && (
                <Button asChild size="sm" className="mt-3">
                  <Link href="/partner/inbox">
                    Review inbox ({newAssignments} new)
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sortedActiveAssignments.map((assignment) => (
                <ActiveAssignmentCard key={assignment.id} assignment={assignment} />
              ))}
            </div>
          )}
        </CardContent>

        {/* New assignments prompt at bottom if any */}
        {newAssignments > 0 && sortedActiveAssignments.length > 0 && (
          <>
            <Separator />
            <CardFooter className="pt-3">
              <div className="flex w-full items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{newAssignments} new</span>{" "}
                  {newAssignments === 1 ? "assignment" : "assignments"} awaiting your response
                </p>
                <Button asChild size="sm">
                  <Link href="/partner/inbox">
                    View inbox <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardFooter>
          </>
        )}
      </Card>

      {/* ── Deliverables ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-lg">Deliverables</CardTitle>
              {deliverables.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {deliverables.length}
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/partner/deliverables">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          {deliverables.length > 0 && (
            <DeliverableStatusSummary deliverables={deliverables} />
          )}
        </CardHeader>

        <CardContent>
          {prioritisedDeliverables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <PackageCheck className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No deliverables yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Deliverables linked to your assignments will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {prioritisedDeliverables.map((deliverable) => (
                <DeliverableRow key={deliverable.id} deliverable={deliverable} />
              ))}
              {deliverables.length > 6 && (
                <p className="pt-1 text-center text-xs text-muted-foreground">
                  + {deliverables.length - 6} more —{" "}
                  <Link
                    href="/partner/deliverables"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    view all
                  </Link>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Quick Actions ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2 relative" asChild>
              <Link href="/partner/inbox">
                <ClipboardList className="h-5 w-5" />
                <span>Assignment Inbox</span>
                {newAssignments > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 min-w-5 px-1 text-xs"
                  >
                    {newAssignments}
                  </Badge>
                )}
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/partner/deliverables">
                <PackageCheck className="h-5 w-5" />
                <span>Deliverables</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2 relative" asChild>
              <Link href="/partner/messages">
                <MessageSquare className="h-5 w-5" />
                <span>Messages</span>
                {totalUnread > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 min-w-5 px-1 text-xs"
                  >
                    {totalUnread}
                  </Badge>
                )}
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/partner/documents">
                <FileText className="h-5 w-5" />
                <span>Documents</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Completion Summary ── */}
      {completedAssignments > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-green-900">
                {completedAssignments} completed assignment
                {completedAssignments !== 1 ? "s" : ""}
              </p>
              <p className="text-sm text-green-700">
                Great work on delivering your assignments.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/partner/reports/history">View History</Link>
          </Button>
        </div>
      )}

      {/* ── Performance Status vs Thresholds ── */}
      <PerformanceAlerts />

      {/* ── Performance Trends ── */}
      <MyPerformanceTrends />
    </div>
  );
}

// ─── My Performance Trends ────────────────────────────────────────────────────

function useMyTrendsQuery(days: number) {
  return useQuery({
    queryKey: ["partner", "my-trends", days],
    queryFn: () => getMyTrends(days),
  });
}

function MyPerformanceTrends() {
  const [dateRange, setDateRange] = React.useState<30 | 90 | 365>(90);
  const { data: trends, isLoading } = useMyTrendsQuery(dateRange);

  return (
    <PerformanceChart
      trends={trends}
      isLoading={isLoading}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      hideAnnotations
    />
  );
}
