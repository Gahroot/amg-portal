"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { usePartnerDeliverableFeedback } from "@/hooks/use-partner-portal";
import { usePartnerAssignments } from "@/hooks/use-partner-portal";
import { ReportContainer, ReportCard, ReportMetric } from "@/components/reports/report-container";
import { Badge } from "@/components/ui/badge";
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

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  submitted: "secondary",
  under_review: "secondary",
  approved: "default",
  returned: "destructive",
  rejected: "destructive",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DeliverableFeedbackPage() {
  const [selectedAssignment, setSelectedAssignment] = useState<string>("all");
  const { data: assignmentsData } = usePartnerAssignments();
  const { data: report, isLoading } = usePartnerDeliverableFeedback(
    selectedAssignment !== "all" ? selectedAssignment : undefined
  );

  const approvedCount = report?.deliverables?.filter((d) => d.status === "approved").length ?? 0;
  const reviewedCount =
    report?.deliverables?.filter((d) => d.reviewed_at !== null).length ?? 0;

  if (isLoading) {
    return (
      <ReportContainer title="Deliverable Feedback Report" isLoading>
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
      subtitle={`Generated ${new Date(report.generated_at!).toLocaleDateString()} · ${report.firm_name}`}
    >
      <Button variant="ghost" size="sm" className="gap-1 -mt-2 self-start" asChild>
        <Link href="/partner/reports">
          <ArrowLeft className="h-4 w-4" /> Back to Reports
        </Link>
      </Button>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        <ReportMetric label="Total Deliverables" value={report.total_deliverables} />
        <ReportMetric label="Approved" value={approvedCount} />
        <ReportMetric label="Reviewed" value={reviewedCount} />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Filter by assignment:</span>
        <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="All assignments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignments</SelectItem>
            {assignmentsData?.assignments.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Deliverables table */}
      <ReportCard title={`Deliverables (${report.total_deliverables})`}>
        {(report.deliverables?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No deliverables found for the selected filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deliverable</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Reviewed</TableHead>
                  <TableHead>Feedback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.deliverables?.map((item) => (
                  <TableRow key={item.deliverable_id}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-medium">{item.title}</p>
                        {item.due_date && (
                          <p className="text-xs text-muted-foreground">
                            Due {formatDate(item.due_date)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.assignment_title ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.deliverable_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[item.status] ?? "outline"}>
                        {item.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(item.submitted_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(item.reviewed_at)}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {item.review_comments ? (
                        <p className="text-sm line-clamp-2">{item.review_comments}</p>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
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
