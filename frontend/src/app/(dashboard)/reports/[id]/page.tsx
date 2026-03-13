"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import {
  useProgramStatusReport,
  useCompletionReport,
} from "@/hooks/use-reports";
import {
  exportProgramStatusReport,
  exportCompletionReport,
  downloadProgramStatusPDF,
  downloadCompletionPDF,
} from "@/lib/api/reports";
import type {
  ProgramStatusReport,
  CompletionReport,
} from "@/lib/api/reports";
import {
  ReportCard,
  ReportMetric,
  ReportStatusBadge,
} from "@/components/reports/report-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Download, FileText, CheckCircle } from "lucide-react";

const ALLOWED_ROLES = [
  "coordinator",
  "relationship_manager",
  "managing_director",
  "finance_compliance",
];

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ragColor(rag: string): string {
  switch (rag) {
    case "green":
      return "bg-green-100 text-green-800";
    case "amber":
      return "bg-amber-100 text-amber-800";
    case "red":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default function ReportDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const programId = params.id as string;

  const [reportType, setReportType] = React.useState<"status" | "completion">(
    "status"
  );

  const statusQuery = useProgramStatusReport(programId);
  const completionQuery = useCompletionReport(programId);

  const activeQuery = reportType === "status" ? statusQuery : completionQuery;

  const handleExportCSV = async () => {
    try {
      if (reportType === "status") {
        await exportProgramStatusReport(programId);
        toast.success("Program status report exported as CSV");
      } else {
        await exportCompletionReport(programId);
        toast.success("Completion report exported as CSV");
      }
    } catch {
      toast.error("Failed to export report");
    }
  };

  const handleExportPDF = async () => {
    try {
      if (reportType === "status") {
        await downloadProgramStatusPDF(programId);
        toast.success("Program status report downloaded as PDF");
      } else {
        await downloadCompletionPDF(programId);
        toast.success("Completion report downloaded as PDF");
      }
    } catch {
      toast.error("Failed to download PDF");
    }
  };

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/reports")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-serif text-3xl font-bold tracking-tight">
                Program Report
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Program ID: {programId}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleExportCSV}
              disabled={activeQuery.isLoading}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleExportPDF}
              disabled={activeQuery.isLoading}
            >
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </div>

        {/* Report Type Tabs */}
        <Tabs
          value={reportType}
          onValueChange={(v) => setReportType(v as "status" | "completion")}
        >
          <TabsList>
            <TabsTrigger value="status">Program Status</TabsTrigger>
            <TabsTrigger value="completion">Completion Report</TabsTrigger>
          </TabsList>

          {/* Program Status Report */}
          <TabsContent value="status">
            {statusQuery.isLoading ? (
              <Card>
                <CardContent className="flex min-h-[300px] items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    Loading program status report...
                  </p>
                </CardContent>
              </Card>
            ) : statusQuery.error ? (
              <Card>
                <CardContent className="flex min-h-[300px] items-center justify-center">
                  <div className="text-center">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">
                      Unable to load program status report. The program may not
                      exist or you may not have access.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : statusQuery.data ? (
              <ProgramStatusView data={statusQuery.data} />
            ) : null}
          </TabsContent>

          {/* Completion Report */}
          <TabsContent value="completion">
            {completionQuery.isLoading ? (
              <Card>
                <CardContent className="flex min-h-[300px] items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    Loading completion report...
                  </p>
                </CardContent>
              </Card>
            ) : completionQuery.error ? (
              <Card>
                <CardContent className="flex min-h-[300px] items-center justify-center">
                  <div className="text-center">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">
                      Unable to load completion report. This program may not be
                      completed yet.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : completionQuery.data ? (
              <CompletionReportView data={completionQuery.data} />
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ============================================================================
// Program Status View
// ============================================================================

function ProgramStatusView({ data }: { data: ProgramStatusReport }) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <ReportCard title="Program">
          <p className="text-lg font-semibold">{data.program_title}</p>
        </ReportCard>
        <ReportCard title="Status">
          <ReportStatusBadge status={data.program_status} />
        </ReportCard>
        <ReportCard title="RAG Status">
          <Badge className={ragColor(data.rag_status)}>
            {data.rag_status.toUpperCase()}
          </Badge>
        </ReportCard>
        <ReportCard title="Milestone Progress">
          <div className="space-y-2">
            <span className="text-lg font-semibold">
              {Math.round(data.milestone_progress)}%
            </span>
            <Progress value={data.milestone_progress} />
          </div>
        </ReportCard>
      </div>

      {/* Dates */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Start Date</p>
              <p className="font-medium">{formatDate(data.start_date)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">End Date</p>
              <p className="font-medium">{formatDate(data.end_date)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Milestones */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">
            Active Milestones ({data.active_milestones.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.active_milestones.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.active_milestones.map((milestone) => (
                  <TableRow key={milestone.id}>
                    <TableCell className="font-medium">
                      {milestone.title}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(milestone.due_date)}
                    </TableCell>
                    <TableCell>
                      <ReportStatusBadge status={milestone.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No active milestones.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Completed Deliverables */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">
            Completed Deliverables ({data.completed_deliverables.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.completed_deliverables.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Reviewed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.completed_deliverables.map((deliverable) => (
                  <TableRow key={deliverable.id}>
                    <TableCell className="font-medium">
                      {deliverable.title}
                    </TableCell>
                    <TableCell className="text-sm">
                      {deliverable.deliverable_type}
                    </TableCell>
                    <TableCell>
                      <ReportStatusBadge status={deliverable.status} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(deliverable.submitted_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(deliverable.reviewed_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No completed deliverables.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pending Decisions */}
      {data.pending_decisions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">
              Pending Decisions ({data.pending_decisions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Deadline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pending_decisions.map((decision) => (
                  <TableRow key={decision.id}>
                    <TableCell className="font-medium">
                      {decision.title}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(decision.requested_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(decision.deadline)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Assigned Partners */}
      {data.assigned_partners.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">
              Assigned Partners ({data.assigned_partners.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firm</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.assigned_partners.map((partner) => (
                  <TableRow key={partner.id}>
                    <TableCell className="font-medium">
                      {partner.firm_name}
                    </TableCell>
                    <TableCell>{partner.contact_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {partner.contact_email}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <p className="text-right text-xs text-muted-foreground">
        Report generated at {formatDate(data.generated_at)}
      </p>
    </div>
  );
}

// ============================================================================
// Completion Report View
// ============================================================================

function CompletionReportView({ data }: { data: CompletionReport }) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <ReportCard title="Program">
          <p className="text-lg font-semibold">{data.program_title}</p>
        </ReportCard>
        <ReportCard title="Client">
          <p className="text-lg font-semibold">{data.client_name}</p>
        </ReportCard>
        <ReportCard title="Timeline">
          <ReportMetric
            label="Adherence"
            value={data.timeline_adherence ?? "N/A"}
          />
        </ReportCard>
        <ReportCard title="Milestones">
          <ReportMetric
            label="Completed"
            value={`${data.completed_milestones}/${data.total_milestones}`}
          />
        </ReportCard>
      </div>

      {/* Budget Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">
            Budget Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Planned Budget</p>
              <p className="text-xl font-semibold">
                {formatCurrency(data.planned_budget)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Actual Budget</p>
              <p className="text-xl font-semibold">
                {formatCurrency(data.actual_budget)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Planned Start</p>
              <p className="font-medium">{formatDate(data.planned_start_date)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Actual End</p>
              <p className="font-medium">{formatDate(data.actual_end_date)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Objectives & Scope */}
      {(data.objectives || data.scope) && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">
              Objectives & Scope
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.objectives && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Objectives
                </p>
                <p className="mt-1 text-sm">{data.objectives}</p>
              </div>
            )}
            {data.scope && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Scope
                </p>
                <p className="mt-1 text-sm">{data.scope}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Milestone Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">
            Milestone Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.milestone_timeline.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Milestone</TableHead>
                  <TableHead>Planned Due</TableHead>
                  <TableHead>Completed At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>On Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.milestone_timeline.map((milestone) => (
                  <TableRow key={milestone.id}>
                    <TableCell className="font-medium">
                      {milestone.title}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(milestone.planned_due_date)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(milestone.actual_completed_at)}
                    </TableCell>
                    <TableCell>
                      <ReportStatusBadge status={milestone.status} />
                    </TableCell>
                    <TableCell>
                      {milestone.on_time === null ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : milestone.on_time ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <span className="text-sm text-red-600">Late</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No milestone data available.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Deliverables */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">
            Deliverables ({data.approved_deliverables}/{data.total_deliverables}{" "}
            approved)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.deliverables.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Reviewed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.deliverables.map((deliverable) => (
                  <TableRow key={deliverable.id}>
                    <TableCell className="font-medium">
                      {deliverable.title}
                    </TableCell>
                    <TableCell className="text-sm">
                      {deliverable.deliverable_type}
                    </TableCell>
                    <TableCell>
                      <ReportStatusBadge status={deliverable.status} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(deliverable.submitted_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(deliverable.reviewed_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No deliverables found.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Partners */}
      {data.partners.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Partners</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firm</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.partners.map((partner) => (
                  <TableRow key={partner.id}>
                    <TableCell className="font-medium">
                      {partner.firm_name}
                    </TableCell>
                    <TableCell>{partner.contact_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {partner.contact_email}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <p className="text-right text-xs text-muted-foreground">
        Report generated at {formatDate(data.generated_at)}
      </p>
    </div>
  );
}
