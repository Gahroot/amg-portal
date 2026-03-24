"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Clock, FileText, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useExpiringDocuments } from "@/hooks/use-documents";
import { getDocumentDownloadUrl } from "@/lib/api/documents";
import type { ExpiringDocumentItem, ExpiryStatus } from "@/types/document";

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
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  return `${days}d`;
}

interface ExpiryBadgeProps {
  status: ExpiryStatus;
  days: number;
}

function ExpiryBadge({ status, days }: ExpiryBadgeProps) {
  if (status === "expired") {
    return (
      <Badge className="gap-1 border-red-300 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-950/50 dark:text-red-300">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
        Expired · {daysLabel(days)}
      </Badge>
    );
  }
  if (status === "expiring_30") {
    return (
      <Badge className="gap-1 border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
        {daysLabel(days)}
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300">
      <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 inline-block" />
      {daysLabel(days)}
    </Badge>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function ExpiringDocumentRow({ doc }: { doc: ExpiringDocumentItem }) {
  function handleDownload() {
    if (doc.download_url) {
      window.open(doc.download_url, "_blank");
    } else {
      getDocumentDownloadUrl(doc.id).then(({ download_url }) => {
        window.open(download_url, "_blank");
      });
    }
  }

  const docTypeLabel = doc.document_type
    ? doc.document_type.charAt(0).toUpperCase() + doc.document_type.slice(1)
    : "Document";

  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{doc.file_name}</p>
        <p className="text-xs text-muted-foreground">
          {docTypeLabel} · Expires {formatDate(doc.expiry_date)} · {formatBytes(doc.file_size)}
        </p>
      </div>
      <ExpiryBadge status={doc.expiry_status} days={doc.days_until_expiry} />
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={handleDownload}
        title="Download"
        className="shrink-0"
      >
        <Download className="size-3" />
      </Button>
    </div>
  );
}

// ── Widget ────────────────────────────────────────────────────────────────────

interface ExpiringDocumentsWidgetProps {
  /** If provided, filter to a specific entity (e.g. a client ID) */
  entityType?: string;
  entityId?: string;
  /** Max rows to show in the widget (default 5) */
  limit?: number;
}

export function ExpiringDocumentsWidget({
  entityType,
  entityId,
  limit = 5,
}: ExpiringDocumentsWidgetProps) {
  const { data, isLoading } = useExpiringDocuments({
    entity_type: entityType,
    entity_id: entityId,
    limit,
  });

  const totalExpired = data?.expired_count ?? 0;
  const total30 = data?.expiring_30_count ?? 0;
  const total90 = data?.expiring_90_count ?? 0;
  const hasAlerts = totalExpired > 0 || total30 > 0 || total90 > 0;

  return (
    <Card className={totalExpired > 0 ? "border-red-300 dark:border-red-800" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle
            className={`h-4 w-4 ${totalExpired > 0 ? "text-red-500" : "text-amber-500"}`}
          />
          Expiring Documents
        </CardTitle>
        <CardDescription className="flex flex-wrap gap-2">
          {isLoading ? (
            <Skeleton className="h-4 w-40" />
          ) : hasAlerts ? (
            <>
              {totalExpired > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  {totalExpired} expired
                </span>
              )}
              {total30 > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {total30} within 30 days
                </span>
              )}
              {total90 > 0 && (
                <span className="text-yellow-600 dark:text-yellow-400">
                  {total90} within 90 days
                </span>
              )}
            </>
          ) : (
            <span>No documents expiring soon</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))
        ) : !data || data.documents.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-center text-sm text-muted-foreground">
            <Clock className="mx-auto h-8 w-8 opacity-30" />
          </div>
        ) : (
          <>
            {data.documents.map((doc) => (
              <ExpiringDocumentRow key={doc.id} doc={doc} />
            ))}
            {(data.total > limit) && (
              <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
                <Link href="/documents/expiring">
                  View all {data.total} expiring documents →
                </Link>
              </Button>
            )}
          </>
        )}
        {!isLoading && hasAlerts && data && data.total <= limit && (
          <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
            <Link href="/documents/expiring">View expiring documents →</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
