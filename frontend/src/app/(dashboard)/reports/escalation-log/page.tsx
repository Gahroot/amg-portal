"use client";

import { useEscalationLogReport } from "@/hooks/use-reports";
import { exportEscalationLog } from "@/lib/api/reports";
import { ReportContainer, ReportCard, ReportMetric, ReportStatusBadge } from "@/components/reports/report-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function levelColor(level: string): string {
  switch (level) {
    case "critical":
      return "bg-red-100 text-red-800";
    case "high":
      return "bg-orange-100 text-orange-800";
    case "medium":
      return "bg-amber-100 text-amber-800";
    case "low":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default function EscalationLogPage() {
  const { data, isLoading } = useEscalationLogReport();

  const handleExport = async () => {
    try {
      await exportEscalationLog();
      toast.success("Escalation log exported");
    } catch {
      toast.error("Failed to export");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-muted-foreground">Loading report…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <ReportContainer
        title="Escalation Log Report"
        subtitle="All escalations with status, ownership, and age tracking"
        onExport={handleExport}
      >
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <ReportCard title="Total">
            <ReportMetric label="Escalations" value={data?.total ?? 0} />
          </ReportCard>
          <ReportCard title="Open">
            <ReportMetric label="Unresolved" value={data?.open_count ?? 0} />
          </ReportCard>
          <ReportCard title="Acknowledged">
            <ReportMetric label="In progress" value={data?.acknowledged_count ?? 0} />
          </ReportCard>
          <ReportCard title="Resolved">
            <ReportMetric label="Closed" value={data?.resolved_count ?? 0} />
          </ReportCard>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Escalation Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Age (hrs)</TableHead>
                  <TableHead>Triggered</TableHead>
                  <TableHead>Resolved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.escalations.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="max-w-[200px] truncate font-medium">
                      {e.title}
                    </TableCell>
                    <TableCell>
                      <Badge className={levelColor(e.level)}>
                        {e.level.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ReportStatusBadge status={e.status} />
                    </TableCell>
                    <TableCell className="text-sm">{e.owner_name}</TableCell>
                    <TableCell className="text-sm">{e.age_hours}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(e.triggered_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.resolved_at
                        ? new Date(e.resolved_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {(!data || data.escalations.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No escalations found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {data && (
          <p className="text-right text-xs text-muted-foreground">
            Generated at {new Date(data.generated_at).toLocaleString()}
          </p>
        )}
      </ReportContainer>
    </div>
  );
}
