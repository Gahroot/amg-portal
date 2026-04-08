"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { usePortfolioOverview, useProgramStatusReport, useExportProgramStatus, useDownloadProgramStatusPDF } from "@/hooks/use-reports";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ReportContainer, ReportMetric, ReportStatusBadge, ReportCard } from "@/components/reports/report-container";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ProgramStatusPage() {
  const { data: portfolio, isLoading: isLoadingPortfolio } = usePortfolioOverview();
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const { data: report, isLoading: isLoadingReport } = useProgramStatusReport(
    selectedProgramId || ""
  );
  const { exportProgramStatus } = useExportProgramStatus();
  const { downloadProgramStatusPDF } = useDownloadProgramStatusPDF();

  // Auto-select first program if available
  if (portfolio && portfolio.programs.length > 0 && !selectedProgramId) {
    setSelectedProgramId(portfolio.programs[0].id);
  }

  const handleExport = () => {
    if (selectedProgramId) {
      exportProgramStatus(selectedProgramId);
    }
  };

  const handleDownloadPDF = () => {
    if (selectedProgramId) {
      downloadProgramStatusPDF(selectedProgramId);
    }
  };

  const isLoading = isLoadingPortfolio || isLoadingReport;

  // Compute derived data from the report
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneWeekFromNow = new Date();
  oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

  const completedThisWeek = report
    ? report.completed_deliverables.filter(
        (d) => d.submitted_at && new Date(d.submitted_at) >= oneWeekAgo
      )
    : [];

  const upcomingMilestones = report
    ? report.active_milestones.filter(
        (m) => m.due_date && new Date(m.due_date) <= oneWeekFromNow
      )
    : [];

  const hasPendingDecisions = (report?.pending_decisions.length ?? 0) > 0;

  return (
    <ReportContainer
      title="Program Status Report"
      subtitle="View active milestones, completed deliverables, and pending decisions"
      onExport={selectedProgramId ? handleExport : undefined}
      onExportPdf={selectedProgramId ? handleDownloadPDF : undefined}
      isLoading={isLoading}
    >
      {/* Program Selector */}
      <ReportCard title="Select Program">
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-md">
            <Select
              value={selectedProgramId || ""}
              onValueChange={setSelectedProgramId}
              disabled={!portfolio || portfolio.programs.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a program" />
              </SelectTrigger>
              <SelectContent>
                {portfolio?.programs.map((program) => (
                  <SelectItem key={program.id} value={program.id}>
                    {program.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedProgramId && report && (
            <div className="flex items-center gap-4">
              <ReportStatusBadge status={report.program_status} />
              <div
                className={`w-3 h-3 rounded-full ${
                  report.rag_status === "green"
                    ? "bg-green-500"
                    : report.rag_status === "amber"
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
                title={`RAG: ${report.rag_status}`}
              />
            </div>
          )}
        </div>
      </ReportCard>

      {/* Report Content */}
      {report && (
        <>
          {/* Last Updated */}
          <p className="text-xs text-muted-foreground text-right">
            Last updated:{" "}
            {new Date(report.generated_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>

          {/* Pending Decisions — prominent CTA */}
          {hasPendingDecisions && (
            <Alert variant="destructive" className="border-amber-400 dark:border-amber-600 bg-amber-50 text-amber-900 dark:text-amber-300 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 !text-amber-600 dark:text-amber-400 dark:!text-amber-400" />
              <AlertTitle className="font-semibold">
                {report.pending_decisions.length} Decision
                {report.pending_decisions.length > 1 ? "s" : ""} Awaiting Your Response
              </AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-4 mt-1">
                <span>
                  Your input is required to keep this program on track.
                </span>
                <Button asChild size="sm" className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white">
                  <Link href="/portal/approvals">Review Decisions</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Program Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <ReportMetric label="Program Status" value={report.program_status.replace(/_/g, " ")} />
            <ReportMetric label="RAG Status" value={report.rag_status.toUpperCase()} />
            <ReportMetric
              label="Active Milestones"
              value={report.active_milestones.length}
            />
            <ReportMetric
              label="Pending Decisions"
              value={report.pending_decisions.length}
            />
          </div>

          {/* Milestone Progress */}
          <ReportCard title="Overall Milestone Progress">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Completion</span>
                <span className="font-semibold">{report.milestone_progress.toFixed(1)}%</span>
              </div>
              <Progress value={report.milestone_progress} className="h-3" />
            </div>
          </ReportCard>

          {/* Timeline */}
          {report.start_date || report.end_date ? (
            <ReportCard title="Timeline">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="font-medium">
                    {report.start_date
                      ? new Date(report.start_date).toLocaleDateString()
                      : "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">End Date</p>
                  <p className="font-medium">
                    {report.end_date
                      ? new Date(report.end_date).toLocaleDateString()
                      : "Not set"}
                  </p>
                </div>
              </div>
            </ReportCard>
          ) : null}

          {/* Upcoming Actions — milestones due within 7 days */}
          {upcomingMilestones.length > 0 && (
            <ReportCard title={`Upcoming Actions (${upcomingMilestones.length} due this week)`}>
              <div className="space-y-3">
                {upcomingMilestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="flex items-start justify-between p-4 border rounded-lg border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-blue-900 dark:text-blue-300">
                          {milestone.title}
                        </h4>
                        <ReportStatusBadge status={milestone.status} />
                      </div>
                      {milestone.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {milestone.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Due</p>
                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                        {milestone.due_date
                          ? new Date(milestone.due_date).toLocaleDateString()
                          : "Not set"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ReportCard>
          )}

          {/* Active Milestones */}
          <ReportCard
            title={`Active Milestones (${report.active_milestones.length})`}
          >
            {report.active_milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active milestones</p>
            ) : (
              <div className="space-y-3">
                {report.active_milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{milestone.title}</h4>
                        <ReportStatusBadge status={milestone.status} />
                      </div>
                      {milestone.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {milestone.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Due</p>
                      <p className="text-sm font-medium">
                        {milestone.due_date
                          ? new Date(milestone.due_date).toLocaleDateString()
                          : "Not set"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ReportCard>

          {/* Completed Items This Week */}
          {completedThisWeek.length > 0 && (
            <ReportCard title={`Completed This Week (${completedThisWeek.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Title</th>
                      <th className="text-left py-3 px-4 font-medium">Type</th>
                      <th className="text-left py-3 px-4 font-medium">Status</th>
                      <th className="text-left py-3 px-4 font-medium">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedThisWeek.map((deliverable) => (
                      <tr key={deliverable.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{deliverable.title}</td>
                        <td className="py-3 px-4 capitalize">
                          {deliverable.deliverable_type.replace(/_/g, " ")}
                        </td>
                        <td className="py-3 px-4">
                          <ReportStatusBadge status={deliverable.status} />
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {deliverable.submitted_at
                            ? new Date(deliverable.submitted_at).toLocaleDateString()
                            : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ReportCard>
          )}

          {/* Completed Deliverables */}
          <ReportCard
            title={`All Completed Deliverables (${report.completed_deliverables.length})`}
          >
            {report.completed_deliverables.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed deliverables yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Title</th>
                      <th className="text-left py-3 px-4 font-medium">Type</th>
                      <th className="text-left py-3 px-4 font-medium">Status</th>
                      <th className="text-left py-3 px-4 font-medium">Due Date</th>
                      <th className="text-left py-3 px-4 font-medium">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.completed_deliverables.map((deliverable) => (
                      <tr key={deliverable.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{deliverable.title}</td>
                        <td className="py-3 px-4 capitalize">{deliverable.deliverable_type.replace(/_/g, " ")}</td>
                        <td className="py-3 px-4">
                          <ReportStatusBadge status={deliverable.status} />
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {deliverable.due_date
                            ? new Date(deliverable.due_date).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {deliverable.submitted_at
                            ? new Date(deliverable.submitted_at).toLocaleDateString()
                            : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ReportCard>

          {/* Pending Decisions */}
          <ReportCard
            title={`Pending Decisions (${report.pending_decisions.length})`}
          >
            {report.pending_decisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending decisions</p>
            ) : (
              <div className="space-y-3">
                {report.pending_decisions.map((decision) => (
                  <div
                    key={decision.id}
                    className="flex items-start justify-between p-4 border rounded-lg border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-amber-900 dark:text-amber-300">
                        {decision.title}
                      </h4>
                      {decision.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {decision.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Requested</p>
                      <p className="text-sm font-medium">
                        {new Date(decision.requested_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ReportCard>

          {/* Assigned Partners */}
          {report.assigned_partners.length > 0 && (
            <ReportCard
              title={`Assigned Partners (${report.assigned_partners.length})`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.assigned_partners.map((partner) => (
                  <div
                    key={partner.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <h4 className="font-medium">{partner.firm_name}</h4>
                    <p className="text-sm text-muted-foreground">{partner.contact_name}</p>
                    <p className="text-sm text-muted-foreground">{partner.contact_email}</p>
                  </div>
                ))}
              </div>
            </ReportCard>
          )}
        </>
      )}

      {!selectedProgramId && !isLoading && (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              Select a program to view its status report
            </p>
          </CardContent>
        </Card>
      )}
    </ReportContainer>
  );
}
