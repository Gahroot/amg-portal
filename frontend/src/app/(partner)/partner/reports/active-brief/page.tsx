"use client";

import Link from "next/link";
import { useActiveBriefSummary } from "@/hooks/use-partner-portal";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ReportContainer,
  ReportMetric,
  ReportStatusBadge,
} from "@/components/reports/report-container";
import { ArrowLeft, ClipboardList } from "lucide-react";

export default function ActiveBriefPage() {
  const { data: report, isLoading } = useActiveBriefSummary();

  if (isLoading) {
    return (
      <ReportContainer title="Active Brief Summary">
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
      subtitle="Your current assignments and deliverable requirements"
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
          <div className="grid grid-cols-3 gap-6">
            <ReportMetric
              label="Active Assignments"
              value={report.total_assignments}
            />
            <ReportMetric
              label="Total Deliverables"
              value={report.total_deliverables}
            />
            <ReportMetric
              label="Pending Deliverables"
              value={report.pending_deliverables}
            />
          </div>
        </CardContent>
      </Card>

      {/* Assignment Briefs */}
      {report.assignments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No active assignments</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {report.assignments.map((assignment) => (
            <Card key={assignment.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-lg">
                      {assignment.title}
                    </CardTitle>
                    {assignment.program_title && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {assignment.program_title}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <ReportStatusBadge status={assignment.status} />
                    {assignment.due_date && (
                      <Badge variant="outline">
                        Due{" "}
                        {new Date(assignment.due_date).toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Brief */}
                <div>
                  <p className="text-sm font-medium mb-1">Brief</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {assignment.brief}
                  </p>
                </div>

                {/* SLA Terms */}
                {assignment.sla_terms && (
                  <div>
                    <p className="text-sm font-medium mb-1">SLA Terms</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {assignment.sla_terms}
                    </p>
                  </div>
                )}

                {/* Deliverables */}
                {assignment.deliverables.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Deliverables ({assignment.deliverables.length})
                    </p>
                    <div className="rounded-md border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left p-2 font-medium">
                              Title
                            </th>
                            <th className="text-left p-2 font-medium">Type</th>
                            <th className="text-left p-2 font-medium">
                              Due Date
                            </th>
                            <th className="text-left p-2 font-medium">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignment.deliverables.map((d) => (
                            <tr key={d.id} className="border-b last:border-0">
                              <td className="p-2">{d.title}</td>
                              <td className="p-2 text-muted-foreground">
                                {d.deliverable_type}
                              </td>
                              <td className="p-2 text-muted-foreground">
                                {d.due_date
                                  ? new Date(
                                      d.due_date,
                                    ).toLocaleDateString()
                                  : "—"}
                              </td>
                              <td className="p-2">
                                <ReportStatusBadge status={d.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </ReportContainer>
  );
}
