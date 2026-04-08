"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Clock, XCircle, CheckCircle2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useExpiringKYCDocuments } from "@/hooks/use-kyc-documents";
import type { KYCDocumentStatus } from "@/types/document";

const STATUS_VARIANT: Record<
  KYCDocumentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  verified: "default",
  pending: "secondary",
  expired: "destructive",
  rejected: "destructive",
};

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function KYCDashboardPage() {
  const router = useRouter();
  const { data: expiringData, isLoading: expiringLoading } =
    useExpiringKYCDocuments(30);

  const expiring30 = expiringData?.total ?? 0;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              KYC Verification
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Know Your Customer document management and compliance tracking
            </p>
          </div>
          <Button asChild>
            <Link href="/kyc/verifications/new">
              <Plus className="size-4" />
              Upload KYC Document
            </Link>
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Review
              </CardTitle>
              <Clock className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">—</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Awaiting verification
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Verified
              </CardTitle>
              <CheckCircle2 className="size-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">—</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Currently active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Expiring Soon
              </CardTitle>
              <ShieldCheck className="size-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {expiringLoading ? "…" : expiring30}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Within 30 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Rejected / Expired
              </CardTitle>
              <XCircle className="size-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">—</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Require re-submission
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link href="/kyc/verifications">All Verifications</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/kyc/alerts">Expiry Alerts</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/kyc/reports">Compliance Report</Link>
          </Button>
        </div>

        {/* Expiring Soon Table */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Expiring Within 30 Days</h2>

          {expiringLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="rounded-md border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiringData?.kyc_documents.map((doc) => (
                    <TableRow
                      key={doc.id}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/kyc/verifications/${doc.id}?client=${doc.client_id}`,
                        )
                      }
                    >
                      <TableCell className="font-medium">
                        <Badge variant="outline">
                          {formatLabel(doc.document_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            STATUS_VARIANT[doc.status as KYCDocumentStatus] ??
                            "outline"
                          }
                        >
                          {formatLabel(doc.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {doc.expiry_date
                          ? new Date(doc.expiry_date).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {new Date(doc.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            href={`/kyc/verifications/${doc.id}?client=${doc.client_id}`}
                          >
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(expiringData?.kyc_documents.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground"
                      >
                        No documents expiring within 30 days.
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
