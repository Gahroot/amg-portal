"use client";

import { useRMPortfolioReport } from "@/hooks/use-reports";
import { exportRMPortfolio } from "@/lib/api/reports";
import { ReportContainer, ReportCard, ReportMetric } from "@/components/reports/report-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function RMPortfolioPage() {
  const { data, isLoading } = useRMPortfolioReport();

  const handleExport = async () => {
    try {
      await exportRMPortfolio();
      toast.success("RM portfolio report exported");
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
        title="RM Portfolio Report"
        subtitle="Client portfolio and program metrics per Relationship Manager"
        onExport={handleExport}
      >
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <ReportCard title="Relationship Managers">
            <ReportMetric label="Active RMs" value={data?.total_rms ?? 0} />
          </ReportCard>
          <ReportCard title="Total Clients">
            <ReportMetric
              label="Across RMs"
              value={data?.entries.reduce((s, e) => s + e.client_count, 0) ?? 0}
            />
          </ReportCard>
          <ReportCard title="Revenue Pipeline">
            <ReportMetric
              label="Active Programs"
              value={formatCurrency(
                data?.entries.reduce((s, e) => s + (e.revenue_pipeline ?? 0), 0) ?? null,
              )}
            />
          </ReportCard>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">RM Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Clients</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Pipeline</TableHead>
                  <TableHead>NPS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.entries.map((e) => (
                  <TableRow key={e.rm_id}>
                    <TableCell className="font-medium">{e.rm_name}</TableCell>
                    <TableCell className="text-sm">{e.rm_email}</TableCell>
                    <TableCell>{e.client_count}</TableCell>
                    <TableCell>{e.active_program_count}</TableCell>
                    <TableCell>{e.completed_program_count}</TableCell>
                    <TableCell>{e.completion_rate}%</TableCell>
                    <TableCell>
                      {e.avg_program_health !== null ? `${e.avg_program_health}%` : "—"}
                    </TableCell>
                    <TableCell>{formatCurrency(e.revenue_pipeline)}</TableCell>
                    <TableCell>{e.avg_nps_score?.toFixed(1) ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {(!data || data.entries.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No relationship managers found.
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
