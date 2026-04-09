"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useExpiringKYCDocuments } from "@/hooks/use-kyc-documents";

const WINDOW_OPTIONS = [
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
  { label: "90 days", value: 90 },
];

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function daysUntilExpiry(expiryDate: string): number {
  return Math.ceil(
    (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

function urgencyBadge(days: number) {
  if (days <= 0) return <Badge variant="destructive">Expired</Badge>;
  if (days <= 14)
    return <Badge variant="destructive">Expires in {days}d</Badge>;
  if (days <= 30)
    return (
      <Badge variant="secondary" className="text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30">
        Expires in {days}d
      </Badge>
    );
  return (
    <Badge variant="secondary" className="text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30">
      Expires in {days}d
    </Badge>
  );
}

export default function KYCAlertsPage() {
  const [windowDays, setWindowDays] = useState(30);

  const { data, isLoading } = useExpiringKYCDocuments(windowDays);

  const docs = data?.kyc_documents ?? [];
  const criticalCount = docs.filter(
    (d) => d.expiry_date && daysUntilExpiry(d.expiry_date) <= 14,
  ).length;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              KYC Expiry Alerts
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Documents expiring soon or requiring renewal
            </p>
          </div>

          <Select
            value={String(windowDays)}
            onValueChange={(v) => setWindowDays(Number(v))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOW_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Critical alert banner */}
        {criticalCount > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>
              <strong>{criticalCount}</strong> document
              {criticalCount !== 1 ? "s" : ""} expire within 14 days and
              require immediate attention.
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16">
            <Clock className="mb-3 size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No documents expiring within {windowDays} days.
            </p>
          </div>
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((doc) => {
                  const days = doc.expiry_date
                    ? daysUntilExpiry(doc.expiry_date)
                    : 0;
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <Badge variant="outline">
                          {formatLabel(doc.document_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>{urgencyBadge(days)}</TableCell>
                      <TableCell>
                        {doc.expiry_date
                          ? new Date(doc.expiry_date).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">
                          {formatLabel(doc.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={`/kyc/verifications/${doc.id}?client=${doc.client_id}`}
                          >
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {data && docs.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {data.total} document{data.total !== 1 ? "s" : ""} expiring within{" "}
            {windowDays} days
          </p>
        )}
      </div>
    </div>
  );
}
