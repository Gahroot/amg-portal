"use client";

import { useParams } from "next/navigation";
import { useCompletionReport, useExportCompletion } from "@/hooks/use-reports";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReportContainer, ReportMetric, ReportStatusBadge, ReportCard } from "@/components/reports/report-container";

export default function CompletionReportPage() {
  const params = useParams();
  const programId = params.programId as string;
  const { data: report, isLoading } = useCompletionReport(programId);
  const { exportCompletion } = useExportCompletion();

  const handleExport = () => {
    exportCompletion(programId);
  };

  if (isLoading) {
    return (
      <ReportContainer title="Completion Report" isLoading>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </ReportContainer>
    );
  }

  if (!report) {
    return (
      <ReportContainer title="Completion Report">
        <p className="text-muted-foreground">Report not found.</p>
      </ReportContainer>
    );
  }

  return (
    <ReportContainer
      title={report.program_title}
      subtitle={`Completion Report • ${new Date(report.generated_at).toLocaleDateString()}`}
      onExport={handleExport}
    >
      {/* Objectives & Scope */}
      {(report.objectives || report.scope) && (
        <ReportCard title="Objectives & Scope">
          <div className="space-y-4">
            {report.objectives && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Objectives</p>
                <p className="text-sm whitespace-pre-wrap">{report.objectives}</p>
              </div>
            )}
            {report.scope && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Scope</p>
                <p className="text-sm whitespace-pre-wrap">{report.scope}</p>
              </div>
            )}
          </div>
        </ReportCard>
      )}

      {/* Timeline Summary */}
      <ReportCard title="Timeline Summary">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-muted-foreground">Planned Start</p>
            <p className="font-medium">
              {report.planned_start_date
                ? new Date(report.planned_start_date).toLocaleDateString()
                : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Planned End</p>
            <p className="font-medium">
              {report.planned_end_date
                ? new Date(report.planned_end_date).toLocaleDateString()
                : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Actual Start</p>
            <p className="font-medium">
              {report.actual_start_date
                ? new Date(report.actual_start_date).toLocaleDateString()
                : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Actual End</p>
            <p className="font-medium">
              {report.actual_end_date
                ? new Date(report.actual_end_date).toLocaleDateString()
                : "N/A"}
            </p>
          </div>
        </div>
        {report.timeline_adherence && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">Timeline Adherence</p>
            <p className="font-medium capitalize">{report.timeline_adherence.replace(/_/g, " ")}</p>
          </div>
        )}
      </ReportCard>

      {/* Budget Summary */}
      {(report.planned_budget || report.actual_budget) && (
        <ReportCard title="Budget Summary">
          <div className="grid grid-cols-2 gap-6">
            {report.planned_budget !== null && (
              <div>
                <p className="text-sm text-muted-foreground">Planned Budget</p>
                <p className="font-medium">${report.planned_budget.toLocaleString()}</p>
              </div>
            )}
            {report.actual_budget !== null && (
              <div>
                <p className="text-sm text-muted-foreground">Actual Budget</p>
                <p className="font-medium">${report.actual_budget.toLocaleString()}</p>
              </div>
            )}
          </div>
        </ReportCard>
      )}

      {/* Milestone Timeline */}
      <ReportCard
        title={`Milestone Timeline (${report.completed_milestones}/${report.total_milestones} completed)`}
      >
        {report.milestone_timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">No milestones</p>
        ) : (
          <div className="space-y-3">
            {report.milestone_timeline.map((milestone) => (
              <div
                key={milestone.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      milestone.status === "completed"
                        ? "bg-green-500"
                        : milestone.status === "in_progress"
                        ? "bg-blue-500"
                        : "bg-gray-400"
                    }`}
                  />
                  <div>
                    <p className="font-medium">{milestone.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Due: {milestone.planned_due_date
                        ? new Date(milestone.planned_due_date).toLocaleDateString()
                        : "Not set"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {milestone.actual_completed_at && (
                    <p className="text-xs text-muted-foreground">
                      Completed: {new Date(milestone.actual_completed_at).toLocaleDateString()}
                    </p>
                  )}
                  <ReportStatusBadge status={milestone.status} />
                  {milestone.on_time !== null && (
                    <span
                      className={`text-xs ${
                        milestone.on_time ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {milestone.on_time ? "On Time" : "Late"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ReportCard>

      {/* Deliverables */}
      <ReportCard
        title={`Deliverables (${report.approved_deliverables}/${report.total_deliverables} approved)`}
      >
        {report.deliverables.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deliverables</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Title</th>
                  <th className="text-left py-3 px-4 font-medium">Type</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">Due Date</th>
                  <th className="text-left py-3 px-4 font-medium">Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {report.deliverables.map((deliverable) => (
                  <tr key={deliverable.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">{deliverable.title}</td>
                    <td className="py-3 px-4 capitalize">
                      {deliverable.deliverable_type.replace(/_/g, " ")}
                    </td>
                    <td className="py-3 px-4">
                      <ReportStatusBadge status={deliverable.status} />
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {deliverable.due_date
                        ? new Date(deliverable.due_date).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {deliverable.reviewed_at
                        ? new Date(deliverable.reviewed_at).toLocaleDateString()
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportCard>

      {/* Partners */}
      {report.partners.length > 0 && (
        <ReportCard title={`Partners (${report.partners.length})`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.partners.map((partner) => (
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
    </ReportContainer>
  );
}
