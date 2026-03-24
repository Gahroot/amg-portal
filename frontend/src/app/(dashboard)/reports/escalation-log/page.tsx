"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import {
  getEscalationLogReport,
  type EscalationLogParams,
} from "@/lib/api/reports";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

const ALLOWED_ROLES = [
  "coordinator",
  "relationship_manager",
  "managing_director",
  "finance_compliance",
];

const ESCALATION_LEVELS = [
  { value: "task", label: "Task" },
  { value: "milestone", label: "Milestone" },
  { value: "program", label: "Program" },
  { value: "client_impact", label: "Client Impact" },
];

const ESCALATION_STATUSES = [
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "investigating", label: "Investigating" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "destructive",
  acknowledged: "secondary",
  investigating: "secondary",
  resolved: "default",
  closed: "outline",
};

const LEVEL_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  task: "outline",
  milestone: "secondary",
  program: "default",
  client_impact: "destructive",
};

function formatAge(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "1d";
  return `${days}d`;
}

export default function EscalationLogReportPage() {
  const { user } = useAuth();
  const [filters, setFilters] = React.useState<EscalationLogParams>({});

  const { data: report, isLoading } = useQuery({
    queryKey: ["escalation-log-report", filters],
    queryFn: () => getEscalationLogReport(filters),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Escalation Log Report
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All escalations with owner, age, resolution status, and time-to-resolve metrics
          </p>
        </div>

        {/* Summary cards */}
        {report && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Escalations
                </CardTitle>
                <AlertTriangle className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{report.total_escalations}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Open / Acknowledged
                </CardTitle>
                <Clock className="size-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{report.open_escalations}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg Resolution Time
                </CardTitle>
                <CheckCircle2 className="size-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {report.avg_resolution_time_days !== null
                    ? `${report.avg_resolution_time_days}d`
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">days (resolved only)</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Select
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, level: v === "all" ? undefined : v }))
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {ESCALATION_LEVELS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, status: v === "all" ? undefined : v }))
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {ESCALATION_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading escalation log...</p>
        ) : (
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Level</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Resolution Time</TableHead>
                  <TableHead>Entity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report?.escalations.map((esc) => (
                  <TableRow key={esc.id}>
                    <TableCell>
                      <Badge variant={LEVEL_BADGE[esc.level] ?? "outline"} className="capitalize text-xs">
                        {esc.level.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium max-w-xs truncate">
                      {esc.title}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>
                        <p>{esc.owner_name ?? "—"}</p>
                        {esc.owner_email && (
                          <p className="text-xs text-muted-foreground">{esc.owner_email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_BADGE[esc.status] ?? "outline"}
                        className="capitalize text-xs"
                      >
                        {esc.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatAge(esc.age_days)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {esc.resolution_time_days !== null
                        ? `${esc.resolution_time_days}d`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {esc.entity_type}
                    </TableCell>
                  </TableRow>
                ))}
                {report?.escalations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No escalations match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {report && (
          <p className="text-xs text-muted-foreground">
            Generated {new Date(report.generated_at).toLocaleString()} ·{" "}
            {report.total_escalations} escalation{report.total_escalations !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
