"use client";

import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import { usePartnerEngagementHistory } from "@/hooks/use-partner-portal";
import { ReportContainer, ReportCard, ReportMetric } from "@/components/reports/report-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  dispatched: "outline",
  accepted: "secondary",
  in_progress: "secondary",
  completed: "default",
  declined: "destructive",
  cancelled: "destructive",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function EngagementHistoryPage() {
  const { data: report, isLoading } = usePartnerEngagementHistory();

  if (isLoading) {
    return (
      <ReportContainer title="Engagement History" isLoading>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </ReportContainer>
    );
  }

  if (!report) {
    return (
      <ReportContainer title="Engagement History">
        <p className="text-muted-foreground">No data available.</p>
      </ReportContainer>
    );
  }

  const completionRate =
    report.total_engagements > 0
      ? Math.round((report.completed_engagements / report.total_engagements) * 100)
      : 0;

  return (
    <ReportContainer
      title="Engagement History"
      subtitle={`Generated ${new Date(report.generated_at).toLocaleDateString()} · ${report.firm_name}`}
    >
      <Button variant="ghost" size="sm" className="gap-1 -mt-2 self-start" asChild>
        <Link href="/partner/reports">
          <ArrowLeft className="h-4 w-4" /> Back to Reports
        </Link>
      </Button>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <ReportMetric label="Total Engagements" value={report.total_engagements} />
        <ReportMetric label="Completed" value={report.completed_engagements} />
        <ReportMetric label="Completion Rate" value={`${completionRate}%`} />
        <ReportMetric
          label="Performance Rating"
          value={
            report.performance_rating !== null
              ? `${report.performance_rating.toFixed(2)} / 5`
              : "N/A"
          }
        />
      </div>

      {/* Performance rating callout */}
      {report.performance_rating !== null && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Star className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="font-medium">Your Performance Rating</p>
            <p className="text-sm text-muted-foreground">
              {report.performance_rating.toFixed(2)} out of 5 — based on your completed assignments
            </p>
          </div>
        </div>
      )}

      {/* Engagement history table */}
      <ReportCard title={`All Engagements (${report.total_engagements})`}>
        {report.assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No engagement history found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Accepted</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Deliverables</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.assignments.map((item) => (
                  <TableRow key={item.assignment_id}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <Link
                          href={`/partner/inbox/${item.assignment_id}`}
                          className="font-medium hover:underline"
                        >
                          {item.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          Created {formatDate(item.created_at)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.program_title ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[item.status] ?? "outline"}>
                        {item.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(item.accepted_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(item.completed_at)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="text-sm">
                          <span className="font-medium">{item.approved_deliverable_count}</span>
                          <span className="text-muted-foreground">
                            {" "}/ {item.deliverable_count} approved
                          </span>
                        </p>
                        {item.deliverable_count > 0 && (
                          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{
                                width: `${(item.approved_deliverable_count / item.deliverable_count) * 100}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ReportCard>
    </ReportContainer>
  );
}
