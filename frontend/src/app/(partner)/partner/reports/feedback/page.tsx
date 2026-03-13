"use client";

import Link from "next/link";
import {
  useDeliverableFeedback,
  useExportDeliverableFeedback,
} from "@/hooks/use-partner-portal";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ReportContainer,
  ReportMetric,
  ReportStatusBadge,
} from "@/components/reports/report-container";
import { ArrowLeft, MessageSquareText } from "lucide-react";

export default function DeliverableFeedbackPage() {
  const { data: report, isLoading } = useDeliverableFeedback();
  const { exportFeedback } = useExportDeliverableFeedback();

  if (isLoading) {
    return (
      <ReportContainer title="Deliverable Feedback Report">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </ReportContainer>
    );
  }

  if (!report) {
    return (
      <ReportContainer title="Deliverable Feedback Report">
        <p className="text-muted-foreground">No data available.</p>
      </ReportContainer>
    );
  }

  return (
    <ReportContainer
      title="Deliverable Feedback Report"
      subtitle="Review comments and approval status for all your deliverables"
      onExport={() => exportFeedback()}
    >
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href="/partner/reports">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Reports
        </Link>
      </Button>

      {/* Summary Stats */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <ReportMetric label="Total" value={report.total} />
            <ReportMetric label="Reviewed" value={report.reviewed_count} />
            <ReportMetric label="Pending" value={report.pending_count} />
            <ReportMetric label="Approved" value={report.approved_count} />
            <ReportMetric label="Returned" value={report.returned_count} />
          </div>
        </CardContent>
      </Card>

      {/* Deliverables Table */}
      {report.deliverables.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquareText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No deliverables found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Deliverable</th>
                  <th className="text-left p-3 font-medium">Assignment</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Submitted</th>
                  <th className="text-left p-3 font-medium">Reviewer</th>
                  <th className="text-left p-3 font-medium">Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {report.deliverables.map((d) => (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{d.title}</td>
                    <td className="p-3 text-muted-foreground">
                      {d.assignment_title}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {d.deliverable_type}
                    </td>
                    <td className="p-3">
                      <ReportStatusBadge status={d.status} />
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {d.submitted_at
                        ? new Date(d.submitted_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {d.reviewer_name || "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {d.reviewed_at
                        ? new Date(d.reviewed_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Feedback Details */}
      {report.deliverables.filter((d) => d.review_comments).length > 0 && (
        <div className="space-y-3">
          <h2 className="font-serif text-xl font-semibold">
            Review Comments
          </h2>
          {report.deliverables
            .filter((d) => d.review_comments)
            .map((d) => (
              <Card key={d.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.assignment_title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <ReportStatusBadge status={d.status} />
                      {d.reviewer_name && (
                        <span className="text-xs text-muted-foreground">
                          by {d.reviewer_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-line border-l-2 border-muted pl-3">
                    {d.review_comments}
                  </p>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </ReportContainer>
  );
}
