"use client";

import { useComplianceAuditReport } from "@/hooks/use-reports";
import { exportComplianceAudit } from "@/lib/api/reports";
import { ReportContainer, ReportCard, ReportMetric, ReportStatusBadge } from "@/components/reports/report-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export default function ComplianceAuditPage() {
  const { data, isLoading } = useComplianceAuditReport();

  const handleExport = async () => {
    try {
      await exportComplianceAudit();
      toast.success("Compliance audit report exported");
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

  const kyc = data?.kyc_summary;
  const audit = data?.access_audit;

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <ReportContainer
        title="Compliance Audit Report"
        subtitle="KYC document status and access audit summary"
        onExport={handleExport}
      >
        {/* KYC Summary */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <ReportCard title="Total KYC">
            <ReportMetric label="Documents" value={kyc?.total_documents ?? 0} />
          </ReportCard>
          <ReportCard title="Current">
            <ReportMetric label="Valid" value={kyc?.current ?? 0} />
          </ReportCard>
          <ReportCard title="Expiring Soon">
            <ReportMetric label="30 days" value={kyc?.expiring_within_30_days ?? 0} />
          </ReportCard>
          <ReportCard title="Expired">
            <ReportMetric label="Past due" value={kyc?.expired ?? 0} />
          </ReportCard>
          <ReportCard title="Pending">
            <ReportMetric label="Awaiting" value={kyc?.pending ?? 0} />
          </ReportCard>
          <ReportCard title="Rejected">
            <ReportMetric label="Denied" value={kyc?.rejected ?? 0} />
          </ReportCard>
        </div>

        {/* KYC by Client */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">
              KYC Document Completeness by Client
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead>Expired</TableHead>
                  <TableHead>Expiring Soon</TableHead>
                  <TableHead>Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.kyc_by_client.map((c) => (
                  <TableRow key={c.client_id}>
                    <TableCell className="font-medium">{c.client_name}</TableCell>
                    <TableCell>{c.total_documents}</TableCell>
                    <TableCell>{c.current}</TableCell>
                    <TableCell className={c.expired > 0 ? "text-red-600 font-medium" : ""}>
                      {c.expired}
                    </TableCell>
                    <TableCell className={c.expiring_soon > 0 ? "text-amber-600 font-medium" : ""}>
                      {c.expiring_soon}
                    </TableCell>
                    <TableCell>{c.pending}</TableCell>
                  </TableRow>
                ))}
                {(!data || data.kyc_by_client.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No KYC data found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Access Audit */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Latest Access Audit</CardTitle>
          </CardHeader>
          <CardContent>
            {audit?.audit_id ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Period</p>
                  <p className="font-medium">{audit.audit_period}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <ReportStatusBadge status={audit.status ?? "unknown"} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Users Reviewed</p>
                  <p className="text-2xl font-semibold">{audit.users_reviewed}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Permissions Verified</p>
                  <p className="text-2xl font-semibold">{audit.permissions_verified}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Anomalies Found</p>
                  <p className="text-2xl font-semibold">{audit.anomalies_found}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Open Findings</p>
                  <p className={`text-2xl font-semibold ${audit.open_findings > 0 ? "text-red-600" : ""}`}>
                    {audit.open_findings}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Findings</p>
                  <p className="text-2xl font-semibold">{audit.total_findings}</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No access audits found.</p>
            )}
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
