"use client";

import * as React from "react";
import {
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  FileText,
} from "lucide-react";
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
import { useExpiringKYCDocuments } from "@/hooks/use-kyc-documents";
import { useClientProfiles } from "@/hooks/use-clients";
import { useKYCDocuments } from "@/hooks/use-kyc-documents";

/** Aggregate KYC status counts for a single client */
function ClientReportRow({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { data } = useKYCDocuments(clientId);
  const docs = data?.kyc_documents ?? [];

  if (docs.length === 0) return null;

  const counts = docs.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {});

  const verified = counts["verified"] ?? 0;
  const pending = counts["pending"] ?? 0;
  const expired = counts["expired"] ?? 0;
  const rejected = counts["rejected"] ?? 0;
  const total = docs.length;
  const pct = total > 0 ? Math.round((verified / total) * 100) : 0;

  return (
    <TableRow>
      <TableCell className="font-medium">{clientName}</TableCell>
      <TableCell>{total}</TableCell>
      <TableCell>
        <Badge variant="default">{verified}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{pending}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant="destructive">{expired + rejected}</Badge>
      </TableCell>
      <TableCell className="w-40">
        <div className="flex items-center gap-2">
          <Progress value={pct} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground w-8">{pct}%</span>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function KYCReportsPage() {
  const { data: clientsData, isLoading: clientsLoading } = useClientProfiles(
    {},
  );
  const { data: expiringData } = useExpiringKYCDocuments(30);

  const clients = clientsData?.profiles ?? [];
  const expiring30 = expiringData?.total ?? 0;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            KYC Compliance Report
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of KYC verification status across all clients
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Clients
              </CardTitle>
              <FileText className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {clientsLoading ? "…" : clients.length}
              </p>
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
              <p className="text-2xl font-bold">{expiring30}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Compliant Clients
              </CardTitle>
              <CheckCircle2 className="size-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">—</p>
              <p className="text-xs text-muted-foreground">All docs verified</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Action Required
              </CardTitle>
              <XCircle className="size-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">—</p>
              <p className="text-xs text-muted-foreground">
                Expired or rejected
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Per-Client Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Client KYC Status</h2>
          </div>

          {clientsLoading ? (
            <p className="text-sm text-muted-foreground">Loading clients...</p>
          ) : (
            <div className="rounded-md border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Total Docs</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Issues</TableHead>
                    <TableHead>Compliance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <ClientReportRow
                      key={client.id}
                      clientId={client.id}
                      clientName={client.display_name ?? client.legal_name}
                    />
                  ))}
                  {clients.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground"
                      >
                        No clients found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
