"use client";

import { usePartnerScorecardReport } from "@/hooks/use-reports";
import { exportPartnerScorecard } from "@/lib/api/reports";
import { ReportContainer, ReportCard, ReportMetric } from "@/components/reports/report-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export default function PartnerScorecardPage() {
  const { data, isLoading } = usePartnerScorecardReport();

  const handleExport = async () => {
    try {
      await exportPartnerScorecard();
      toast.success("Partner scorecard exported");
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
        title="Partner Performance Scorecard"
        subtitle="Aggregated partner quality, timeliness, and completion metrics"
        onExport={handleExport}
      >
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <ReportCard title="Total Partners">
            <ReportMetric label="Partners" value={data?.total_partners ?? 0} />
          </ReportCard>
          <ReportCard title="Avg Overall">
            <ReportMetric
              label="Score"
              value={
                data?.partners.length
                  ? (
                      data.partners.reduce(
                        (s, p) => s + (p.avg_overall ?? 0),
                        0,
                      ) / data.partners.filter((p) => p.avg_overall !== null).length || 0
                    ).toFixed(1)
                  : "—"
              }
            />
          </ReportCard>
          <ReportCard title="Total SLA Breaches">
            <ReportMetric
              label="Breaches"
              value={data?.partners.reduce((s, p) => s + p.sla_breach_count, 0) ?? 0}
            />
          </ReportCard>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Partner Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firm</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Timeliness</TableHead>
                  <TableHead>Communication</TableHead>
                  <TableHead>Overall</TableHead>
                  <TableHead>Ratings</TableHead>
                  <TableHead>Assignments</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead>SLA Breaches</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.partners.map((p) => (
                  <TableRow key={p.partner_id}>
                    <TableCell className="font-medium">{p.firm_name}</TableCell>
                    <TableCell>{p.avg_quality?.toFixed(1) ?? "—"}</TableCell>
                    <TableCell>{p.avg_timeliness?.toFixed(1) ?? "—"}</TableCell>
                    <TableCell>{p.avg_communication?.toFixed(1) ?? "—"}</TableCell>
                    <TableCell>{p.avg_overall?.toFixed(1) ?? "—"}</TableCell>
                    <TableCell>{p.total_ratings}</TableCell>
                    <TableCell>{p.completed_assignments}/{p.total_assignments}</TableCell>
                    <TableCell>{p.completion_rate}%</TableCell>
                    <TableCell>{p.sla_breach_count}</TableCell>
                  </TableRow>
                ))}
                {(!data || data.partners.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No partner data found.
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
