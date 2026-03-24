"use client";

import { usePortfolioOverview, useExportPortfolio, useDownloadPortfolioPDF } from "@/hooks/use-reports";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReportContainer, ReportMetric, ReportStatusBadge, ReportCard } from "@/components/reports/report-container";

export default function PortfolioOverviewPage() {
  const { data: report, isLoading } = usePortfolioOverview();
  const { exportPortfolio } = useExportPortfolio();
  const { downloadPortfolioPDF } = useDownloadPortfolioPDF();

  if (isLoading) {
    return (
      <ReportContainer title="Portfolio Overview" isLoading>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </ReportContainer>
    );
  }

  if (!report) {
    return (
      <ReportContainer title="Portfolio Overview">
        <p className="text-muted-foreground">No data available.</p>
      </ReportContainer>
    );
  }

  return (
    <ReportContainer
      title="Portfolio Overview"
      subtitle={`As of ${new Date(report.generated_at).toLocaleDateString()}`}
      onExport={exportPortfolio}
      onExportPdf={downloadPortfolioPDF}
    >
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <ReportMetric label="Total Programs" value={report.total_programs} />
        <ReportMetric label="Active Programs" value={report.active_programs} />
        <ReportMetric label="Completed Programs" value={report.completed_programs} />
        <ReportMetric
          label="Total Budget"
          value={`$${(report.total_budget || 0).toLocaleString()}`}
        />
      </div>

      {/* Overall Progress */}
      <ReportCard title="Overall Milestone Progress">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Completion Across All Programs</span>
            <span className="text-lg font-semibold">
              {report.overall_milestone_progress.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${report.overall_milestone_progress}%` }}
            />
          </div>
        </div>
      </ReportCard>

      {/* Status Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ReportCard title="Programs by Status">
          <div className="space-y-3">
            {Object.entries(report.status_breakdown).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ReportStatusBadge status={status} />
                  <span className="text-sm capitalize">{status.replace(/_/g, " ")}</span>
                </div>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
            {Object.keys(report.status_breakdown).length === 0 && (
              <p className="text-sm text-muted-foreground">No programs yet</p>
            )}
          </div>
        </ReportCard>

        <ReportCard title="RAG Status Summary">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm">On Track</span>
              </div>
              <span className="font-semibold">{report.rag_summary.green || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-sm">At Risk</span>
              </div>
              <span className="font-semibold">{report.rag_summary.amber || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm">Off Track</span>
              </div>
              <span className="font-semibold">{report.rag_summary.red || 0}</span>
            </div>
          </div>
        </ReportCard>
      </div>

      {/* All Programs */}
      <ReportCard
        title={`All Programs (${report.programs.length})`}
      >
        {report.programs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No programs yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Program</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">RAG</th>
                  <th className="text-left py-3 px-4 font-medium">Timeline</th>
                  <th className="text-left py-3 px-4 font-medium">Budget</th>
                  <th className="text-left py-3 px-4 font-medium">Progress</th>
                </tr>
              </thead>
              <tbody>
                {report.programs.map((program) => (
                  <tr key={program.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div className="font-medium">{program.title}</div>
                    </td>
                    <td className="py-3 px-4">
                      <ReportStatusBadge status={program.status} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            program.rag_status === "green"
                              ? "bg-green-500"
                              : program.rag_status === "amber"
                              ? "bg-amber-500"
                              : "bg-red-500"
                          }`}
                        />
                        <span className="capitalize text-xs">{program.rag_status}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {program.start_date && program.end_date
                        ? `${formatDate(program.start_date)} - ${formatDate(program.end_date)}`
                        : program.start_date
                        ? `From ${formatDate(program.start_date)}`
                        : "Not set"}
                    </td>
                    <td className="py-3 px-4">
                      {program.budget_envelope
                        ? `$${program.budget_envelope.toLocaleString()}`
                        : "N/A"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${program.milestone_progress}%` }}
                          />
                        </div>
                        <span className="text-xs">{program.milestone_progress.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportCard>
    </ReportContainer>
  );
}

// Helper function for date formatting
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
