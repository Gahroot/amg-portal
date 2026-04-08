"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, Download, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  getRMPortfolioReport,
  getEscalationLogReport,
  getComplianceAuditReport,
  getAnnualReview,
} from "@/lib/api/reports";
import { useAuth } from "@/providers/auth-provider";
import {
  FavoriteStarButton,
  ReportFavoritesSection,
} from "@/components/reports/report-favorites";
import type { DashboardReportType } from "@/components/reports/report-favorites";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ─── Constants ──────────────────────────────────────────────────────────────

type ReportType =
  | "rm_portfolio"
  | "escalation_log"
  | "compliance"
  | "annual_review";

interface ReportOption {
  value: ReportType;
  label: string;
  description: string;
  roles: string[];
  hasExport: boolean;
}

const REPORT_OPTIONS: ReportOption[] = [
  {
    value: "rm_portfolio",
    label: "RM Portfolio",
    description: "Client portfolio, program health, and revenue pipeline by relationship manager",
    roles: ["managing_director", "relationship_manager"],
    hasExport: false,
  },
  {
    value: "escalation_log",
    label: "Escalation Log",
    description: "All escalations with owner, age, resolution status, and time-to-resolve metrics",
    roles: ["managing_director", "relationship_manager", "coordinator", "finance_compliance"],
    hasExport: true,
  },
  {
    value: "compliance",
    label: "Compliance Audit",
    description: "KYC status, access anomalies, and user account overview",
    roles: ["managing_director", "finance_compliance"],
    hasExport: false,
  },
  {
    value: "annual_review",
    label: "Annual Review",
    description: "Year-in-review covering program activity, partner performance, and engagement value",
    roles: ["managing_director", "relationship_manager"],
    hasExport: true,
  },
];

const ESCALATION_LEVEL_LABELS: Record<string, string> = {
  task: "Task",
  milestone: "Milestone",
  program: "Program",
  client_impact: "Client Impact",
};

const ESCALATION_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  open: "destructive",
  acknowledged: "secondary",
  investigating: "secondary",
  resolved: "default",
  closed: "outline",
};

const RAG_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  green: "default",
  amber: "secondary",
  red: "destructive",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | null, prefix = ""): string {
  if (n === null) return "—";
  return (
    prefix +
    new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n)
  );
}

function downloadCsv(rows: string[][], filename: string): void {
  const content = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Date Range Picker ──────────────────────────────────────────────────────

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}

function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value?.from ? (
            value.to ? (
              <>
                {format(value.from, "MMM d, yyyy")} — {format(value.to, "MMM d, yyyy")}
              </>
            ) : (
              format(value.from, "MMM d, yyyy")
            )
          ) : (
            <span>Pick a date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          numberOfMonths={2}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── Preview Panels ─────────────────────────────────────────────────────────

function RMPortfolioPreview({ data }: { data: Awaited<ReturnType<typeof getRMPortfolioReport>> }) {
  return (
    <div className="space-y-6">
      {/* Identity row */}
      <div className="rounded-md border bg-white px-5 py-4">
        <p className="font-semibold">{data.rm_name}</p>
        <p className="text-sm text-muted-foreground">{data.rm_email}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total Clients", value: data.total_clients },
          { label: "Active Programs", value: data.total_active_programs },
          { label: "Revenue Pipeline", value: fmt(data.total_revenue_pipeline, "$") },
          {
            label: "Avg NPS Score",
            value: data.avg_nps_score !== null ? data.avg_nps_score.toFixed(1) : "—",
          },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <p className="text-2xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Client table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Programs</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Pipeline</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.clients.map((c) => (
              <TableRow key={c.client_id}>
                <TableCell className="font-medium">{c.client_name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize text-xs">
                    {c.client_type.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell>{c.total_programs}</TableCell>
                <TableCell>{c.active_programs}</TableCell>
                <TableCell className="w-36">
                  {c.milestone_completion_rate !== null ? (
                    <div className="flex items-center gap-2">
                      <Progress value={c.milestone_completion_rate} className="h-2 flex-1" />
                      <span className="w-9 text-xs text-muted-foreground">
                        {c.milestone_completion_rate}%
                      </span>
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-sm">{fmt(c.revenue_pipeline, "$")}</TableCell>
              </TableRow>
            ))}
            {data.clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No clients found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Generated {new Date(data.generated_at).toLocaleString()}
      </p>
    </div>
  );
}

function EscalationLogPreview({
  data,
}: {
  data: Awaited<ReturnType<typeof getEscalationLogReport>>;
}) {
  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Escalations", value: data.total_escalations },
          { label: "Open / Acknowledged", value: data.open_escalations },
          {
            label: "Avg Resolution Time",
            value:
              data.avg_resolution_time_days !== null
                ? `${data.avg_resolution_time_days}d`
                : "—",
          },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <p className="text-2xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Level</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Resolved In</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.escalations.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <Badge variant="outline" className="text-xs capitalize">
                    {ESCALATION_LEVEL_LABELS[e.level] ?? e.level}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-xs truncate font-medium">{e.title}</TableCell>
                <TableCell className="text-sm">{e.owner_name ?? "—"}</TableCell>
                <TableCell>
                  <Badge
                    variant={ESCALATION_STATUS_VARIANT[e.status] ?? "outline"}
                    className="text-xs capitalize"
                  >
                    {e.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {e.age_days === 0 ? "Today" : `${e.age_days}d`}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {e.resolution_time_days !== null ? `${e.resolution_time_days}d` : "—"}
                </TableCell>
              </TableRow>
            ))}
            {data.escalations.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No escalations found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Generated {new Date(data.generated_at).toLocaleString()}
      </p>
    </div>
  );
}

function CompliancePreview({
  data,
}: {
  data: Awaited<ReturnType<typeof getComplianceAuditReport>>;
}) {
  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total Clients", value: data.total_clients },
          { label: "KYC Current", value: data.kyc_current },
          { label: "KYC Expiring (30d)", value: data.kyc_expiring_30d },
          { label: "KYC Expired", value: data.kyc_expired },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <p className="text-2xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* KYC table */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Client KYC Status</h3>
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>KYC Status</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Completeness</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.client_kyc_statuses.map((c) => (
                <TableRow key={c.client_id}>
                  <TableCell className="font-medium">{c.client_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {c.client_type.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        c.kyc_status === "current"
                          ? "default"
                          : c.kyc_status === "expired"
                            ? "destructive"
                            : "secondary"
                      }
                      className="text-xs capitalize"
                    >
                      {c.kyc_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{c.total_documents}</TableCell>
                  <TableCell className="w-36">
                    <div className="flex items-center gap-2">
                      <Progress value={c.document_completeness_pct} className="h-2 flex-1" />
                      <span className="w-9 text-xs text-muted-foreground">
                        {c.document_completeness_pct}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {data.client_kyc_statuses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No clients found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* User stats */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">User Account Summary</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <span>
            Total: <strong>{data.total_users}</strong>
          </span>
          <span>
            Active: <strong>{data.active_users}</strong>
          </span>
          <span>
            Inactive: <strong>{data.inactive_users}</strong>
          </span>
          <span>
            Deactivated: <strong>{data.deactivated_users}</strong>
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Generated {new Date(data.generated_at).toLocaleString()}
      </p>
    </div>
  );
}

function AnnualReviewPreview({
  data,
}: {
  data: Awaited<ReturnType<typeof getAnnualReview>>;
}) {
  return (
    <div className="space-y-6">
      {/* Identity */}
      <div className="rounded-md border bg-white px-5 py-4">
        <p className="font-semibold">{data.client_name}</p>
        <p className="text-sm text-muted-foreground">Annual Review — {data.year}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total Programs", value: data.total_programs },
          { label: "New Programs", value: data.new_programs },
          { label: "Completed", value: data.completed_programs },
          { label: "Engagement Value", value: fmt(data.total_engagement_value, "$") },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <p className="text-2xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Partner performance */}
      {data.partner_performance.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Partner Performance</h3>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Assignments</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Avg Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.partner_performance.map((p) => (
                  <TableRow key={p.partner_id}>
                    <TableCell className="font-medium">{p.firm_name}</TableCell>
                    <TableCell>{p.total_assignments}</TableCell>
                    <TableCell>{p.completed_assignments}</TableCell>
                    <TableCell>
                      {p.avg_performance_rating !== null
                        ? Number(p.avg_performance_rating).toFixed(1)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Programs */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Programs ({data.year})</h3>
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>RAG</TableHead>
                <TableHead>Budget</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.programs.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {p.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={RAG_VARIANT[p.rag_status] ?? "outline"}
                      className="text-xs uppercase"
                    >
                      {p.rag_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{fmt(p.budget_envelope, "$")}</TableCell>
                </TableRow>
              ))}
              {data.programs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No programs for this year.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Generated {new Date(data.generated_at).toLocaleString()}
      </p>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { user } = useAuth();

  const [reportType, setReportType] = React.useState<ReportType>("rm_portfolio");
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const [generated, setGenerated] = React.useState(false);

  // Derived year from dateRange (for annual_review)
  const selectedYear = React.useMemo(() => {
    if (dateRange?.from) return dateRange.from.getFullYear();
    return new Date().getFullYear();
  }, [dateRange]);

  // Filter available report types based on user role
  const availableReports = React.useMemo(() => {
    if (!user) return [];
    return REPORT_OPTIONS.filter((r) => r.roles.includes(user.role));
  }, [user]);

  const selectedReport = REPORT_OPTIONS.find((r) => r.value === reportType);

  // RM Portfolio query
  const rmPortfolioQuery = useQuery({
    queryKey: ["report-builder", "rm_portfolio"],
    queryFn: () => getRMPortfolioReport(),
    enabled: generated && reportType === "rm_portfolio",
    retry: 1,
  });

  // Escalation Log query
  const escalationQuery = useQuery({
    queryKey: ["report-builder", "escalation_log"],
    queryFn: () => getEscalationLogReport(),
    enabled: generated && reportType === "escalation_log",
    retry: 1,
  });

  // Compliance query
  const complianceQuery = useQuery({
    queryKey: ["report-builder", "compliance"],
    queryFn: () => getComplianceAuditReport(),
    enabled: generated && reportType === "compliance",
    retry: 1,
  });

  // Annual Review query
  const annualQuery = useQuery({
    queryKey: ["report-builder", "annual_review", selectedYear],
    queryFn: () => getAnnualReview(selectedYear),
    enabled: generated && reportType === "annual_review",
    retry: 1,
  });

  const activeQuery =
    reportType === "rm_portfolio"
      ? rmPortfolioQuery
      : reportType === "escalation_log"
        ? escalationQuery
        : reportType === "compliance"
          ? complianceQuery
          : annualQuery;

  function handleGenerate() {
    setGenerated(true);
    activeQuery.refetch();
  }

  function handleReportTypeChange(value: ReportType) {
    setReportType(value);
    setGenerated(false);
  }

  function handleExportCsv() {
    if (reportType === "escalation_log" && escalationQuery.data) {
      const d = escalationQuery.data;
      const rows: string[][] = [
        ["Level", "Title", "Owner", "Status", "Age (days)", "Resolution Time (days)"],
        ...d.escalations.map((e) => [
          e.level,
          e.title,
          e.owner_name ?? "",
          e.status,
          String(e.age_days),
          e.resolution_time_days !== null ? String(e.resolution_time_days) : "",
        ]),
      ];
      downloadCsv(rows, `escalation_log_${format(new Date(), "yyyyMMdd")}.csv`);
      toast.success("Escalation log exported.");
    } else if (reportType === "annual_review" && annualQuery.data) {
      const d = annualQuery.data;
      const rows: string[][] = [
        ["Title", "Status", "RAG Status", "Budget"],
        ...d.programs.map((p) => [
          p.title,
          p.status,
          p.rag_status,
          p.budget_envelope !== null ? String(p.budget_envelope) : "",
        ]),
      ];
      downloadCsv(rows, `annual_review_${d.year}_${format(new Date(), "yyyyMMdd")}.csv`);
      toast.success("Annual review exported.");
    }
  }

  const isLoading = activeQuery.isFetching;
  const hasData = activeQuery.isSuccess && activeQuery.data;
  const hasError = activeQuery.isError;

  if (!user) return null;

  if (availableReports.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">You do not have permission to view reports.</p>
      </div>
    );
  }

  // Ensure selected report type is accessible; reset to first available if not
  const validReportType = availableReports.find((r) => r.value === reportType)
    ? reportType
    : availableReports[0]?.value;

  if (validReportType !== reportType) {
    setReportType(validReportType ?? "rm_portfolio");
  }

  function handleSelectFavorite(type: DashboardReportType) {
    handleReportTypeChange(type);
    setGenerated(true);
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* ── Page header ─────────────────────────────────── */}
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Report Builder</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a report type, optionally filter by date range, then generate and export.
          </p>
        </div>

        {/* ── Favorites section ───────────────────────────── */}
        <ReportFavoritesSection onSelectReport={handleSelectFavorite} />

        {/* ── Controls panel ──────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Report Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Row 1 — type + date range */}
            <div className="flex flex-wrap items-end gap-4">
              {/* Report type select + star */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Report Type</label>
                <div className="flex items-center gap-1.5">
                  <Select
                    value={reportType}
                    onValueChange={(v) => handleReportTypeChange(v as ReportType)}
                  >
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="Select report type" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableReports.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FavoriteStarButton reportType={reportType} size="default" />
                </div>
              </div>

              {/* Date range picker */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Date Range
                  {reportType === "annual_review" && (
                    <span className="ml-1 text-xs text-muted-foreground">(year from start)</span>
                  )}
                </label>
                <DateRangePicker value={dateRange} onChange={setDateRange} />
              </div>

              {/* Clear date range */}
              {dateRange && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-end text-muted-foreground"
                  onClick={() => setDateRange(undefined)}
                >
                  Clear dates
                </Button>
              )}
            </div>

            {/* Description */}
            {selectedReport && (
              <p className="text-sm text-muted-foreground">{selectedReport.description}</p>
            )}

            <Separator />

            {/* Actions row */}
            <div className="flex items-center gap-3">
              <Button onClick={handleGenerate} disabled={isLoading} className="gap-2">
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Generate Report
                  </>
                )}
              </Button>

              {generated && hasData && selectedReport?.hasExport && (
                <Button variant="outline" onClick={handleExportCsv} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              )}

              {reportType === "annual_review" && generated && (
                <span className="text-sm text-muted-foreground">Year: {selectedYear}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Preview panel ───────────────────────────────── */}
        {generated && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {selectedReport?.label ?? "Report"} Preview
              </h2>
              {hasData && (
                <Badge variant="outline" className="text-xs">
                  Live data
                </Badge>
              )}
            </div>

            {/* Loading state */}
            {isLoading && (
              <div className="flex min-h-[200px] items-center justify-center rounded-lg border bg-white">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading report data…</span>
                </div>
              </div>
            )}

            {/* Error state */}
            {!isLoading && hasError && (
              <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5">
                <div className="text-center">
                  <p className="font-medium text-destructive">Failed to load report</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeQuery.error instanceof Error
                      ? activeQuery.error.message
                      : "An error occurred. Please try again."}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => activeQuery.refetch()}
                  >
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {/* Data preview */}
            {!isLoading && hasData && (
              <div className="rounded-lg border bg-[#FDFBF7] p-6">
                {reportType === "rm_portfolio" && rmPortfolioQuery.data && (
                  <RMPortfolioPreview data={rmPortfolioQuery.data} />
                )}
                {reportType === "escalation_log" && escalationQuery.data && (
                  <EscalationLogPreview data={escalationQuery.data} />
                )}
                {reportType === "compliance" && complianceQuery.data && (
                  <CompliancePreview data={complianceQuery.data} />
                )}
                {reportType === "annual_review" && annualQuery.data && (
                  <AnnualReviewPreview data={annualQuery.data} />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
