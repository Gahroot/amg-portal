"use client";

import Link from "next/link";
import { Mail, User, ArrowLeft } from "lucide-react";
import { usePartnerBriefSummary } from "@/hooks/use-partner-portal";
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
  dispatched: "outline",
  accepted: "secondary",
  in_progress: "default",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function BriefSummaryPage() {
  const { data: report, isLoading } = usePartnerBriefSummary();

  if (isLoading) {
    return (
      <ReportContainer title="Active Brief Summary" isLoading>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </ReportContainer>
    );
  }

  if (!report) {
    return (
      <ReportContainer title="Active Brief Summary">
        <p className="text-muted-foreground">No data available.</p>
      </ReportContainer>
    );
  }

  return (
    <ReportContainer
      title="Active Brief Summary"
      subtitle={`Generated ${new Date(report.generated_at).toLocaleDateString()} · ${report.firm_name}`}
    >
      <Button variant="ghost" size="sm" className="gap-1 -mt-2 self-start" asChild>
        <Link href="/partner/reports">
          <ArrowLeft className="h-4 w-4" /> Back to Reports
        </Link>
      </Button>

      {/* Summary metric */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ReportMetric label="Active Assignments" value={report.total_active} />
      </div>

      {/* Assignment table */}
      <ReportCard title={`Active Assignments (${report.total_active})`}>
        {report.assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No active assignments at this time.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Coordinator</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.assignments.map((item) => (
                  <TableRow key={item.assignment_id}>
                    <TableCell>
                      <div className="space-y-1">
                        <Link
                          href={`/partner/inbox/${item.assignment_id}`}
                          className="font-medium hover:underline"
                        >
                          {item.assignment_title}
                        </Link>
                        {item.brief && (
                          <p className="text-xs text-muted-foreground line-clamp-2 max-w-xs">
                            {item.brief}
                          </p>
                        )}
                        {item.sla_terms && (
                          <p className="text-xs text-amber-600 line-clamp-1">
                            SLA: {item.sla_terms}
                          </p>
                        )}
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
                    <TableCell className="text-sm">
                      {item.due_date ? (
                        <span
                          className={
                            new Date(item.due_date) < new Date()
                              ? "text-destructive font-medium"
                              : "text-muted-foreground"
                          }
                        >
                          {formatDate(item.due_date)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.coordinator_name || item.coordinator_email ? (
                        <div className="space-y-0.5">
                          {item.coordinator_name && (
                            <div className="flex items-center gap-1 text-sm">
                              <User className="h-3 w-3 text-muted-foreground" />
                              {item.coordinator_name}
                            </div>
                          )}
                          {item.coordinator_email && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              <a
                                href={`mailto:${item.coordinator_email}`}
                                className="hover:underline"
                              >
                                {item.coordinator_email}
                              </a>
                            </div>
                          )}
                        </div>
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
