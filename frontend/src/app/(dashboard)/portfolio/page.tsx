"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Briefcase,
  CheckSquare,
  ChevronRight,
  Clock,
  Mail,
  Plus,
  ShieldAlert,
  Users,
  Zap,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  usePortfolioSummary,
  useAtRiskPrograms,
  useRealTimeStats,
  useDashboardAlerts,
} from "@/hooks/use-dashboard";
import { ProgramHealthTable } from "@/components/dashboard/program-health-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================================
// Constants
// ============================================================================

const ALLOWED_ROLES = [
  "managing_director",
  "relationship_manager",
  "coordinator",
  "finance_compliance",
];

// ============================================================================
// Metric card
// ============================================================================

interface MetricCardProps {
  title: string;
  value: number | undefined;
  description: string;
  icon: React.ReactNode;
  href?: string;
  alert?: boolean;
  isLoading?: boolean;
}

function MetricCard({
  title,
  value,
  description,
  icon,
  href,
  alert = false,
  isLoading = false,
}: MetricCardProps) {
  const isAlert = alert && (value ?? 0) > 0;

  const content = (
    <Card
      className={[
        "transition-colors",
        href ? "hover:border-primary/40 cursor-pointer" : "",
        isAlert ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle
          className={`text-sm font-medium ${
            isAlert ? "text-red-700 dark:text-red-300" : "text-muted-foreground"
          }`}
        >
          {title}
        </CardTitle>
        <span
          className={`h-4 w-4 ${isAlert ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
        >
          {icon}
        </span>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <>
            <p
              className={`text-2xl font-bold ${isAlert ? "text-red-700 dark:text-red-300" : ""}`}
            >
              {value ?? 0}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// ============================================================================
// Quick actions
// ============================================================================

interface QuickAction {
  label: string;
  href: string;
  icon: React.ReactNode;
  variant: "default" | "secondary" | "outline";
  roles: string[];
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "New Client",
    href: "/clients/new",
    icon: <Users className="mr-1.5 h-3.5 w-3.5" />,
    variant: "default",
    roles: ["managing_director", "relationship_manager"],
  },
  {
    label: "New Program",
    href: "/programs/new",
    icon: <Plus className="mr-1.5 h-3.5 w-3.5" />,
    variant: "default",
    roles: ["managing_director", "relationship_manager", "coordinator"],
  },
  {
    label: "New Communication",
    href: "/communications",
    icon: <Mail className="mr-1.5 h-3.5 w-3.5" />,
    variant: "secondary",
    roles: [
      "managing_director",
      "relationship_manager",
      "coordinator",
      "finance_compliance",
    ],
  },
  {
    label: "New Escalation",
    href: "/escalations",
    icon: <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />,
    variant: "secondary",
    roles: ["managing_director", "relationship_manager", "coordinator"],
  },
  {
    label: "Pending Decisions",
    href: "/decisions",
    icon: <CheckSquare className="mr-1.5 h-3.5 w-3.5" />,
    variant: "outline",
    roles: [
      "managing_director",
      "relationship_manager",
      "coordinator",
      "finance_compliance",
    ],
  },
  {
    label: "Review Approvals",
    href: "/approvals",
    icon: <Zap className="mr-1.5 h-3.5 w-3.5" />,
    variant: "outline",
    roles: ["managing_director", "finance_compliance"],
  },
];

function QuickActions({ role }: { role: string }) {
  const visible = QUICK_ACTIONS.filter((a) => a.roles.includes(role));
  if (visible.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Actions</CardTitle>
        <CardDescription>Common tasks for your role</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {visible.map((action) => (
            <Button
              key={action.href}
              size="sm"
              variant={action.variant}
              asChild
            >
              <Link href={action.href}>
                {action.icon}
                {action.label}
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// RAG status summary
// ============================================================================

interface RagSummaryProps {
  breakdown: Record<string, number>;
}

function RagSummary({ breakdown }: RagSummaryProps) {
  const red = breakdown["red"] ?? 0;
  const amber = breakdown["amber"] ?? 0;
  const green = breakdown["green"] ?? 0;

  return (
    <div className="flex flex-wrap gap-2">
      <Badge
        variant="outline"
        className="gap-1.5 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-1 text-sm text-red-800 dark:text-red-300"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
        Red — {red}
      </Badge>
      <Badge
        variant="outline"
        className="gap-1.5 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-1 text-sm text-amber-800 dark:text-amber-300"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
        Amber — {amber}
      </Badge>
      <Badge
        variant="outline"
        className="gap-1.5 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-3 py-1 text-sm text-green-800 dark:text-green-300"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
        Green — {green}
      </Badge>
    </div>
  );
}

// ============================================================================
// Alerts section
// ============================================================================

const SEVERITY_STYLES: Record<
  string,
  { badge: string; dot: string }
> = {
  critical: {
    badge: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300",
    dot: "bg-red-500",
  },
  warning: {
    badge: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  info: {
    badge: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300",
    dot: "bg-blue-500",
  },
};

function AlertsList({
  alerts,
  isLoading,
}: {
  alerts: Array<{
    id: string;
    severity: string;
    title: string;
    description: string;
    link: string | null;
  }> | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No active alerts. Everything looks good.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {alerts.slice(0, 6).map((alert) => {
        const styles = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.info;
        const inner = (
          <li
            key={alert.id}
            className="flex items-start gap-3 rounded-md border p-3 text-sm"
          >
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${styles.dot}`}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium leading-snug">{alert.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {alert.description}
              </p>
            </div>
            <Badge
              variant="outline"
              className={`shrink-0 capitalize text-xs ${styles.badge}`}
            >
              {alert.severity}
            </Badge>
            {alert.link && (
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </li>
        );

        return alert.link ? (
          <Link key={alert.id} href={alert.link} className="block">
            {inner}
          </Link>
        ) : (
          inner
        );
      })}
    </ul>
  );
}

// ============================================================================
// Page skeleton
// ============================================================================

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent>
              <Skeleton className="mb-1 h-8 w-14" />
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Page
// ============================================================================

export default function PortfolioPage() {
  const { user } = useAuth();
  const role = user?.role ?? "";

  const { data: summary, isLoading: summaryLoading } = usePortfolioSummary();
  const { data: atRisk, isLoading: atRiskLoading } = useAtRiskPrograms();
  const { data: realTimeStats, isLoading: statsLoading } = useRealTimeStats();
  const { data: alertsData, isLoading: alertsLoading } = useDashboardAlerts();

  if (!ALLOWED_ROLES.includes(role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  const isLoading = summaryLoading || statsLoading;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          My Portfolio
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          An overview of your assigned clients, programs, and outstanding
          actions.
        </p>
      </div>

      {/* ── Metric cards ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <PageSkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Assigned Clients"
            value={summary?.total_clients}
            description="Active client relationships"
            icon={<Users className="h-4 w-4" />}
            href="/clients"
          />
          <MetricCard
            title="Active Programs"
            value={realTimeStats?.active_programs ?? summary?.active_programs}
            description="Programs currently in progress"
            icon={<Briefcase className="h-4 w-4" />}
            href="/programs"
          />
          <MetricCard
            title="Pending Decisions"
            value={summary?.total_pending_decisions}
            description="Awaiting your input or approval"
            icon={<CheckSquare className="h-4 w-4" />}
            href="/decisions"
            alert
          />
          <MetricCard
            title="Open Escalations"
            value={
              realTimeStats?.open_escalations ??
              summary?.total_open_escalations
            }
            description="Issues requiring immediate attention"
            icon={<ShieldAlert className="h-4 w-4" />}
            href="/escalations"
            alert
          />
        </div>
      )}

      {/* ── Secondary metrics ──────────────────────────────────────────────── */}
      {!isLoading && (realTimeStats ?? summary) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            title="SLA Breaches"
            value={realTimeStats?.sla_breaches ?? summary?.total_sla_breaches}
            description="Programs exceeding SLA thresholds"
            icon={<Clock className="h-4 w-4" />}
            href="/sla"
            alert
          />
          <MetricCard
            title="Upcoming Deadlines"
            value={realTimeStats?.upcoming_deadlines}
            description="Milestones due in the next 7 days"
            icon={<Zap className="h-4 w-4" />}
          />
          <MetricCard
            title="Pending Approvals"
            value={realTimeStats?.pending_approvals}
            description="Items awaiting approval sign-off"
            icon={<CheckSquare className="h-4 w-4" />}
            href="/approvals"
            alert
          />
        </div>
      )}

      {/* ── RAG breakdown + Quick actions ──────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* RAG breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Program Health</CardTitle>
            <CardDescription>
              RAG status breakdown across all active programs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="flex gap-2">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-7 w-24" />
              </div>
            ) : summary ? (
              <RagSummary breakdown={summary.rag_breakdown} />
            ) : (
              <p className="text-sm text-muted-foreground">No data available.</p>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <QuickActions role={role} />
      </div>

      {/* ── Alerts ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Active Alerts</CardTitle>
              <CardDescription>
                Critical and warning items across your portfolio
              </CardDescription>
            </div>
            {alertsData && alertsData.total > 6 && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/escalations">
                  View all {alertsData.total}
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <AlertsList
            alerts={alertsData?.alerts}
            isLoading={alertsLoading}
          />
        </CardContent>
      </Card>

      {/* ── At-risk programs ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                At-Risk Programs
              </CardTitle>
              <CardDescription>
                Programs with red RAG status or active escalations
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/programs">
                All programs
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {atRiskLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : atRisk && atRisk.programs.length > 0 ? (
            <ProgramHealthTable programs={atRisk.programs} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No at-risk programs — all programs are on track.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
