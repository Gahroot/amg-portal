"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import {
  listAccessAudits,
  getAccessAuditStatistics,
  createAccessAudit,
  getCurrentQuarterAudit,
} from "@/lib/api/access-audits";
import type { AccessAuditListParams, CreateAccessAuditRequest } from "@/types/access-audit";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const ALLOWED_ROLES = ["finance_compliance", "managing_director"];

const PAGE_SIZE = 50;

export default function AccessAuditsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filters, setFilters] = React.useState<AccessAuditListParams>({});
  const [quarterFilter, setQuarterFilter] = React.useState<number | undefined>(undefined);
  const [page, setPage] = React.useState(0);
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [newQuarter, setNewQuarter] = React.useState(1);
  const [newYear, setNewYear] = React.useState(new Date().getFullYear());

  const queryParams = { ...filters, skip: page * PAGE_SIZE, limit: PAGE_SIZE };

  const { data, isLoading } = useQuery({
    queryKey: ["access-audits", queryParams],
    queryFn: () => listAccessAudits(queryParams),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  const { data: stats } = useQuery({
    queryKey: ["access-audit-statistics"],
    queryFn: getAccessAuditStatistics,
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  const { data: currentAudit } = useQuery({
    queryKey: ["current-quarter-audit"],
    queryFn: getCurrentQuarterAudit,
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateAccessAuditRequest) => createAccessAudit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-audits"] });
      queryClient.invalidateQueries({ queryKey: ["access-audit-statistics"] });
      queryClient.invalidateQueries({ queryKey: ["current-quarter-audit"] });
      setShowCreateDialog(false);
    },
  });

  // Auto-determine current quarter
  React.useEffect(() => {
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    setNewQuarter(quarter);
    setNewYear(now.getFullYear());
  }, []);

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Access Audits
          </h1>
          <Button onClick={() => setShowCreateDialog(true)}>
            New Audit
          </Button>
        </div>

        {/* Current Quarter Alert */}
        {currentAudit && (
          <div
            className="rounded-lg border bg-blue-50 p-4 cursor-pointer"
            onClick={() => router.push(`/access-audits/${currentAudit.id}`)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Current Quarter Audit</p>
                <p className="text-sm text-muted-foreground">
                  {currentAudit.audit_period} - {currentAudit.anomalies_found} findings
                </p>
              </div>
              <StatusBadge status={currentAudit.status} />
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-muted-foreground">Total Audits</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-muted-foreground">Total Findings</p>
              <p className="text-2xl font-bold">{stats.total_findings}</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-muted-foreground">Open Findings</p>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.open_findings}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm text-muted-foreground">Remediated</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.remediated_findings}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <Select
            onValueChange={(value) => {
              setPage(0);
              setFilters((f) => ({
                ...f,
                status: value === "all" ? undefined : value,
              }));
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select
            onValueChange={(value) => {
              setPage(0);
              setFilters((f) => ({
                ...f,
                year: value === "all" ? undefined : parseInt(value),
              }));
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            onValueChange={(value) => {
              setPage(0);
              setQuarterFilter(value === "all" ? undefined : parseInt(value));
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Quarter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Quarters</SelectItem>
              <SelectItem value="1">Q1</SelectItem>
              <SelectItem value="2">Q2</SelectItem>
              <SelectItem value="3">Q3</SelectItem>
              <SelectItem value="4">Q4</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading audits...</p>
        ) : (
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Auditor</TableHead>
                  <TableHead>Users Reviewed</TableHead>
                  <TableHead>Findings</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.audits
                  .filter((audit) => !quarterFilter || audit.quarter === quarterFilter)
                  .map((audit) => (
                  <TableRow
                    key={audit.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/access-audits/${audit.id}`)}
                  >
                    <TableCell className="font-medium">
                      {audit.audit_period}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={audit.status} />
                    </TableCell>
                    <TableCell>{audit.auditor_name || "-"}</TableCell>
                    <TableCell>{audit.users_reviewed}</TableCell>
                    <TableCell>
                      <span
                        className={
                          audit.anomalies_found > 0
                            ? "text-red-600 font-medium"
                            : ""
                        }
                      >
                        {audit.anomalies_found}
                      </span>
                    </TableCell>
                    <TableCell>
                      {audit.completed_at
                        ? new Date(audit.completed_at).toLocaleDateString()
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {data?.audits.filter((a) => !quarterFilter || a.quarter === quarterFilter).length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No access audits found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} audit{data?.total !== 1 ? "s" : ""} total
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Access Audit</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium">Quarter</label>
              <Select
                value={newQuarter.toString()}
                onValueChange={(v) => setNewQuarter(parseInt(v))}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1</SelectItem>
                  <SelectItem value="2">Q2</SelectItem>
                  <SelectItem value="3">Q3</SelectItem>
                  <SelectItem value="4">Q4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Year</label>
              <Select
                value={newYear.toString()}
                onValueChange={(v) => setNewYear(parseInt(v))}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                createMutation.mutate({ quarter: newQuarter, year: newYear })
              }
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Audit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
