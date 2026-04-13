"use client";

import { useState } from "react";
import { Download, AlertTriangle, Clock, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useExpiringDocuments } from "@/hooks/use-documents";
import { getDocumentDownloadUrl } from "@/lib/api/documents";
import type { ExpiringDocumentItem, ExpiryStatus } from "@/types/document";
import { isExpiryStatus } from "@/lib/type-guards";
import { DataTableExport } from "@/components/ui/data-table-export";
import type { ExportColumn } from "@/lib/export-utils";
import { API_BASE_URL } from "@/lib/constants";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} overdue`;
  if (days === 0) return "Today";
  return `${days} day${days !== 1 ? "s" : ""}`;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function ExpiryStatusBadge({ status, days }: { status: ExpiryStatus; days: number }) {
  if (status === "expired") {
    return (
      <Badge className="gap-1 border-red-300 bg-red-100 dark:bg-red-900/30 text-red-800 dark:border-red-700 dark:text-red-300">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
        Expired — {daysLabel(days)}
      </Badge>
    );
  }
  if (status === "expiring_30") {
    return (
      <Badge className="gap-1 border-amber-300 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:border-amber-700 dark:text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
        Expiring — {daysLabel(days)}
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-800 dark:border-yellow-700 dark:text-yellow-300">
      <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 inline-block" />
      Expiring — {daysLabel(days)}
    </Badge>
  );
}

// ── Row highlight ─────────────────────────────────────────────────────────────

function rowClass(status: ExpiryStatus): string {
  if (status === "expired") return "bg-red-50/50 dark:bg-red-950/10";
  if (status === "expiring_30") return "bg-amber-50/40 dark:bg-amber-950/10";
  return "";
}

// ── Summary bar ───────────────────────────────────────────────────────────────

interface SummaryBarProps {
  expired: number;
  expiring30: number;
  expiring90: number;
}

function SummaryBar({ expired, expiring30, expiring90 }: SummaryBarProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Badge
        variant="outline"
        className="gap-1.5 border-red-200 bg-red-50 px-3 py-1 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
      >
        <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
        Expired — {expired}
      </Badge>
      <Badge
        variant="outline"
        className="gap-1.5 border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
      >
        <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
        Within 30 days — {expiring30}
      </Badge>
      <Badge
        variant="outline"
        className="gap-1.5 border-yellow-200 bg-yellow-50 px-3 py-1 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300"
      >
        <span className="h-2 w-2 rounded-full bg-yellow-500 inline-block" />
        Within 90 days — {expiring90}
      </Badge>
    </div>
  );
}

// ── Export columns ────────────────────────────────────────────────────────────

const EXPORT_COLUMNS: ExportColumn<ExpiringDocumentItem>[] = [
  { header: "File Name", accessor: "file_name" },
  { header: "Document Type", accessor: (r) => r.document_type ?? "general" },
  { header: "Category", accessor: "category" },
  { header: "Entity Type", accessor: "entity_type" },
  { header: "Expiry Date", accessor: (r) => formatDate(r.expiry_date) },
  { header: "Status", accessor: "expiry_status" },
  { header: "Days Until Expiry", accessor: "days_until_expiry" },
  { header: "Description", accessor: (r) => r.description ?? "" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExpiringDocumentsPage() {
  const [statusFilter, setStatusFilter] = useState<
    "all" | "expired" | "expiring_30" | "expiring_90"
  >("all");

  const { data, isLoading } = useExpiringDocuments({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 100,
  });

  function handleDownload(doc: ExpiringDocumentItem) {
    if (doc.download_url) {
      window.open(doc.download_url, "_blank");
    } else {
      getDocumentDownloadUrl(doc.id).then(({ download_url }) => {
        window.open(download_url, "_blank");
      });
    }
  }

  const documents = data?.documents ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Expiring Documents
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Passports, visas, and certifications expiring within 90 days or already expired
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as typeof statusFilter)
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="expiring_30">Within 30 days</SelectItem>
              <SelectItem value="expiring_90">Within 90 days</SelectItem>
            </SelectContent>
          </Select>
          <DataTableExport
            visibleRows={documents}
            columns={EXPORT_COLUMNS}
            fileName="expiring-documents"
            exportAllUrl={(() => {
              const params = new URLSearchParams();
              if (statusFilter !== "all") params.set("status", statusFilter);
              const qs = params.toString();
              return `${API_BASE_URL}/api/v1/export/documents${qs ? `?${qs}` : ""}`;
            })()}
          />
        </div>
      </div>

      {/* Summary */}
      {!isLoading && data && (
        <SummaryBar
          expired={data.expired_count}
          expiring30={data.expiring_30_count}
          expiring90={data.expiring_90_count}
        />
      )}

      {/* Table card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Documents Requiring Attention
          </CardTitle>
          <CardDescription>
            {isLoading
              ? "Loading…"
              : `${data?.total ?? 0} document${(data?.total ?? 0) !== 1 ? "s" : ""} flagged`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Clock className="h-10 w-10 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">
                No documents expiring in this period.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="w-16">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const expiryStatus: ExpiryStatus = isExpiryStatus(doc.expiry_status)
                    ? doc.expiry_status
                    : "valid";
                  return (
                  <TableRow key={doc.id} className={rowClass(expiryStatus)}>
                    <TableCell className="max-w-[200px]">
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{doc.file_name}</span>
                      </div>
                      {doc.description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {doc.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {doc.document_type ?? "general"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <span className="capitalize">{doc.entity_type}</span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDate(doc.expiry_date)}
                    </TableCell>
                    <TableCell>
                      <ExpiryStatusBadge
                        status={expiryStatus}
                        days={doc.days_until_expiry}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatBytes(doc.file_size)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDownload(doc)}
                        title="Download"
                      >
                        <Download className="size-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
