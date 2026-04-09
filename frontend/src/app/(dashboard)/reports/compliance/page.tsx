"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { getComplianceAuditReport } from "@/lib/api/reports";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  Clock,
  XCircle,
  ShieldAlert,
  Users,
  FileSearch,
} from "lucide-react";

const ALLOWED_ROLES = ["finance_compliance", "managing_director"];

const KYC_STATUS_BADGE: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  current: "default",
  expiring: "secondary",
  expired: "destructive",
  pending: "outline",
  incomplete: "outline",
};

const SEVERITY_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  critical: "destructive",
};

const USER_STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  inactive: "secondary",
  deactivated: "destructive",
};

import { ROLE_LABELS } from "@/lib/constants";

export default function ComplianceAuditReportPage() {
  const { user } = useAuth();

  const { data: report, isLoading } = useQuery({
    queryKey: ["compliance-audit-report"],
    queryFn: () => getComplianceAuditReport(),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Compliance Audit Report
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            KYC status, access anomalies, and user account review
            {report?.latest_audit_period && ` — Latest audit: ${report.latest_audit_period}`}
          </p>
        </div>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading compliance data...</p>
        )}

        {report && (
          <>
            {/* KYC Summary Cards */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ShieldAlert className="size-5 text-muted-foreground" />
                KYC Overview
              </h2>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Clients
                    </CardTitle>
                    <Users className="size-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{report.total_clients}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      KYC Current
                    </CardTitle>
                    <CheckCircle2 className="size-4 text-emerald-500" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{report.kyc_current}</p>
                    <p className="text-xs text-muted-foreground">verified documents</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Expiring (30d)
                    </CardTitle>
                    <Clock className="size-4 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{report.kyc_expiring_30d}</p>
                    <p className="text-xs text-muted-foreground">action required soon</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Expired
                    </CardTitle>
                    <XCircle className="size-4 text-destructive" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{report.kyc_expired}</p>
                    <p className="text-xs text-muted-foreground">immediate action required</p>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Client KYC Status Table */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold">Client KYC Status</h2>
              <div className="rounded-md border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>KYC Status</TableHead>
                      <TableHead>Total Docs</TableHead>
                      <TableHead>Current</TableHead>
                      <TableHead>Expiring</TableHead>
                      <TableHead>Expired</TableHead>
                      <TableHead>Pending</TableHead>
                      <TableHead>Completeness</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.client_kyc_statuses.map((client) => (
                      <TableRow key={client.client_id}>
                        <TableCell className="font-medium">{client.client_name}</TableCell>
                        <TableCell>
                          <span className="text-sm capitalize text-muted-foreground">
                            {client.client_type.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={KYC_STATUS_BADGE[client.kyc_status] ?? "outline"}
                            className="capitalize text-xs"
                          >
                            {client.kyc_status}
                          </Badge>
                        </TableCell>
                        <TableCell>{client.total_documents}</TableCell>
                        <TableCell>
                          {client.current > 0 ? (
                            <Badge variant="default">{client.current}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {client.expiring_30d > 0 ? (
                            <Badge variant="secondary">{client.expiring_30d}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {client.expired > 0 ? (
                            <Badge variant="destructive">{client.expired}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {client.pending > 0 ? (
                            <Badge variant="outline">{client.pending}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">0</span>
                          )}
                        </TableCell>
                        <TableCell className="w-36">
                          {client.total_documents > 0 ? (
                            <div className="flex items-center gap-2">
                              <Progress
                                value={client.document_completeness_pct}
                                className="h-2 flex-1"
                              />
                              <span className="text-xs text-muted-foreground w-9">
                                {client.document_completeness_pct}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {report.client_kyc_statuses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          No clients found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>

            {/* Access Anomalies */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <FileSearch className="size-5 text-muted-foreground" />
                Access Anomalies
                {report.access_anomalies.length > 0 && (
                  <Badge variant="destructive">{report.access_anomalies.length} open</Badge>
                )}
              </h2>
              {report.access_anomalies.length === 0 ? (
                <div className="rounded-md border bg-card px-5 py-4">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    No open access anomalies
                    {report.latest_audit_period && ` in ${report.latest_audit_period}`}.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Audit Period</TableHead>
                        <TableHead>Finding Type</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.access_anomalies.map((anomaly) => (
                        <TableRow key={anomaly.id}>
                          <TableCell className="text-sm">{anomaly.audit_period}</TableCell>
                          <TableCell>
                            <span className="text-sm capitalize">
                              {anomaly.finding_type.replace(/_/g, " ")}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={SEVERITY_BADGE[anomaly.severity] ?? "outline"}
                              className="capitalize text-xs"
                            >
                              {anomaly.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm max-w-xs truncate">
                            {anomaly.description}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize text-xs">
                              {anomaly.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            {/* User Account Status */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Users className="size-5 text-muted-foreground" />
                  User Accounts
                </h2>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>Active: <strong className="text-foreground">{report.active_users}</strong></span>
                  <span>Inactive: <strong className="text-foreground">{report.inactive_users}</strong></span>
                  <span>Deactivated: <strong className="text-foreground">{report.deactivated_users}</strong></span>
                </div>
              </div>
              <div className="rounded-md border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Account Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.user_account_statuses.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.full_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {ROLE_LABELS[u.role] ?? u.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={USER_STATUS_BADGE[u.status] ?? "outline"}
                            className="capitalize text-xs"
                          >
                            {u.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {report.user_account_statuses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No users found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>

            <p className="text-xs text-muted-foreground">
              Generated {new Date(report.generated_at).toLocaleString()}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
