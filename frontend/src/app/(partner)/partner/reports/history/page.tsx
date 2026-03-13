"use client";

import Link from "next/link";
import {
  useEngagementHistory,
  useExportEngagementHistory,
} from "@/hooks/use-partner-portal";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ReportContainer,
  ReportMetric,
  ReportStatusBadge,
} from "@/components/reports/report-container";
import { ArrowLeft, History, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

function ScoreBar({ value, max = 5 }: { value: number; max?: number }) {
  const pct = (value / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-6 text-right">
        {value}
      </span>
    </div>
  );
}

export default function EngagementHistoryPage() {
  const { data: report, isLoading } = useEngagementHistory();
  const { exportHistory } = useExportEngagementHistory();

  if (isLoading) {
    return (
      <ReportContainer title="Engagement History">
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

  const { stats } = report;

  return (
    <ReportContainer
      title="Engagement History"
      subtitle="Past and current engagements with performance data"
      onExport={exportHistory}
    >
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href="/partner/reports">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Reports
        </Link>
      </Button>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Engagement Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <ReportMetric
                label="Total"
                value={stats.total_engagements}
              />
              <ReportMetric
                label="Completed"
                value={stats.completed_engagements}
              />
              <ReportMetric
                label="Completion Rate"
                value={`${stats.completion_rate}%`}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4" />
              Average Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.average_overall !== null ? (
              <>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Quality</p>
                  <ScoreBar value={stats.average_quality ?? 0} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Timeliness
                  </p>
                  <ScoreBar value={stats.average_timeliness ?? 0} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Communication
                  </p>
                  <ScoreBar value={stats.average_communication ?? 0} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Overall</p>
                  <ScoreBar value={stats.average_overall ?? 0} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No ratings yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Engagements Table */}
      {report.engagements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <History className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No engagements found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Assignment</th>
                  <th className="text-left p-3 font-medium">Program</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Due Date</th>
                  <th className="text-left p-3 font-medium">Completed</th>
                  <th className="text-left p-3 font-medium">Rating</th>
                </tr>
              </thead>
              <tbody>
                {report.engagements.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{e.title}</td>
                    <td className="p-3 text-muted-foreground">
                      {e.program_title || "—"}
                    </td>
                    <td className="p-3">
                      <ReportStatusBadge status={e.status} />
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {e.due_date
                        ? new Date(e.due_date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {e.completed_at
                        ? new Date(e.completed_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="p-3">
                      {e.rating ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {e.rating.overall_score}/5
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </ReportContainer>
  );
}
