"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPartnerTrends } from "@/lib/api/partners";
import type { Assignment } from "@/lib/api/assignments";
import type { PerformanceNotice } from "@/lib/api/performance-notices";
import { PerformanceChart } from "@/components/partners/performance-chart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

const ASSIGNMENT_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  dispatched: "secondary",
  accepted: "default",
  in_progress: "default",
  completed: "default",
  cancelled: "destructive",
};

const NOTICE_TYPE_LABELS: Record<string, string> = {
  sla_breach: "SLA Breach",
  quality_issue: "Quality Issue",
  general_performance: "General Performance",
};

const SEVERITY_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  warning: "secondary",
  formal_notice: "default",
  final_notice: "destructive",
};

interface AssignmentHistoryTableProps {
  assignments: Assignment[];
}

export function AssignmentHistoryTable({ assignments }: AssignmentHistoryTableProps) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Program</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Due Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((assignment) => (
            <TableRow key={assignment.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/assignments/${assignment.id}`}
                  className="hover:underline"
                >
                  {assignment.title}
                </Link>
              </TableCell>
              <TableCell>
                {assignment.program_title ?? "-"}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    ASSIGNMENT_STATUS_VARIANT[assignment.status] ??
                    "outline"
                  }
                >
                  {assignment.status.replace(/_/g, " ")}
                </Badge>
              </TableCell>
              <TableCell>
                {assignment.due_date
                  ? new Date(
                      assignment.due_date
                    ).toLocaleDateString()
                  : "-"}
              </TableCell>
            </TableRow>
          ))}
          {assignments.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-center text-muted-foreground"
              >
                No assignments found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

interface PerformanceNoticesSectionProps {
  notices: PerformanceNotice[];
  total: number;
  unacknowledgedCount: number;
  isMD: boolean;
  onIssueNotice: () => void;
}

export function PerformanceNoticesSection({
  notices,
  total,
  unacknowledgedCount,
  isMD,
  onIssueNotice,
}: PerformanceNoticesSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {total} notice{total !== 1 ? "s" : ""} on record
            {unacknowledgedCount > 0 && (
              <span className="ml-2 text-destructive font-medium">
                · {unacknowledgedCount} unacknowledged
              </span>
            )}
          </p>
        </div>
        {isMD && (
          <Button variant="destructive" size="sm" onClick={onIssueNotice}>
            Issue Performance Notice
          </Button>
        )}
      </div>

      {notices.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No performance notices on record for this partner.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => (
            <Card
              key={notice.id}
              className={
                notice.status === "open"
                  ? "border-destructive/40 bg-destructive/5"
                  : ""
              }
            >
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={SEVERITY_VARIANT[notice.severity] ?? "outline"}>
                      {notice.severity.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant="outline">
                      {NOTICE_TYPE_LABELS[notice.notice_type] ?? notice.notice_type}
                    </Badge>
                    {notice.status === "open" ? (
                      <Badge variant="destructive">Unacknowledged</Badge>
                    ) : (
                      <Badge variant="secondary">Acknowledged</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(notice.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div>
                  <p className="font-medium text-sm">{notice.title}</p>
                  {notice.program_title && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Program: {notice.program_title}
                    </p>
                  )}
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">
                  {notice.description}
                </p>

                {notice.required_action && (
                  <div className="rounded-md bg-muted px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">
                      Required Action
                    </p>
                    <p className="text-sm">{notice.required_action}</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                  <span>
                    Issued by {notice.issuer_name ?? "Managing Director"}
                  </span>
                  {notice.acknowledged_at && (
                    <span>
                      Acknowledged{" "}
                      {new Date(notice.acknowledged_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface PartnerTrendsProps {
  partnerId: string;
}

export function PartnerTrends({ partnerId }: PartnerTrendsProps) {
  const [dateRange, setDateRange] = useState<30 | 90 | 365>(90);

  const { data: trends, isLoading } = useQuery({
    queryKey: ["partner-trends", partnerId, dateRange],
    queryFn: () => getPartnerTrends(partnerId, dateRange),
    enabled: !!partnerId,
  });

  return (
    <PerformanceChart
      trends={trends}
      isLoading={isLoading}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
    />
  );
}
