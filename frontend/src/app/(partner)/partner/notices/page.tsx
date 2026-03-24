"use client";

import * as React from "react";
import { AlertTriangle, Bell, CheckCircle, ShieldAlert } from "lucide-react";
import { useMyPerformanceNotices, useAcknowledgePerformanceNotice } from "@/hooks/use-partner-portal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import type { PerformanceNotice, NoticeType, NoticeSeverity } from "@/lib/api/partner-portal";

// ─── Display helpers ──────────────────────────────────────────────────────────

const NOTICE_TYPE_LABELS: Record<NoticeType, string> = {
  sla_breach: "SLA Breach",
  quality_issue: "Quality Issue",
};

const SEVERITY_LABELS: Record<NoticeSeverity, string> = {
  warning: "Warning",
  formal_notice: "Formal Notice",
  final_notice: "Final Notice",
};

const SEVERITY_BADGE_VARIANT: Record<
  NoticeSeverity,
  "default" | "secondary" | "destructive" | "outline"
> = {
  warning: "outline",
  formal_notice: "secondary",
  final_notice: "destructive",
};

const NOTICE_TYPE_BADGE_VARIANT: Record<
  NoticeType,
  "default" | "secondary" | "destructive" | "outline"
> = {
  sla_breach: "destructive",
  quality_issue: "secondary",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Notice card ──────────────────────────────────────────────────────────────

function NoticeCard({ notice }: { notice: PerformanceNotice }) {
  const acknowledge = useAcknowledgePerformanceNotice();
  const isOpen = notice.status === "open";

  return (
    <Card className={isOpen ? "border-red-200" : "border-muted"}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`mt-0.5 shrink-0 rounded-full p-1.5 ${
                isOpen ? "bg-red-100" : "bg-muted"
              }`}
            >
              {isOpen ? (
                <ShieldAlert className="h-4 w-4 text-red-600" />
              ) : (
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base leading-snug">{notice.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Issued {formatDate(notice.created_at)}
                {notice.issuer_name ? ` · ${notice.issuer_name}` : ""}
              </p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={NOTICE_TYPE_BADGE_VARIANT[notice.notice_type]}>
              {NOTICE_TYPE_LABELS[notice.notice_type]}
            </Badge>
            <Badge variant={SEVERITY_BADGE_VARIANT[notice.severity]}>
              {SEVERITY_LABELS[notice.severity]}
            </Badge>
            {!isOpen && (
              <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                Acknowledged
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Program context */}
        {notice.program_title && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Program:</span> {notice.program_title}
          </p>
        )}

        {/* Description */}
        <div>
          <p className="text-sm font-medium mb-1">Notice</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{notice.description}</p>
        </div>

        {/* Required action */}
        {notice.required_action && (
          <div className="rounded-md border border-orange-200 bg-orange-50 px-4 py-3">
            <p className="text-sm font-medium text-orange-800 mb-1">Required Action</p>
            <p className="text-sm text-orange-700 leading-relaxed">{notice.required_action}</p>
          </div>
        )}

        {/* Acknowledge footer */}
        <div className="flex items-center justify-between pt-1">
          {isOpen ? (
            <>
              <p className="text-xs text-muted-foreground">
                Please review and acknowledge this notice to confirm receipt.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => acknowledge.mutate(notice.id)}
                disabled={acknowledge.isPending}
              >
                {acknowledge.isPending ? "Acknowledging…" : "Acknowledge"}
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Acknowledged {notice.acknowledged_at ? formatDate(notice.acknowledged_at) : ""}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PerformanceNoticesPage() {
  const { data, isLoading, isError } = useMyPerformanceNotices();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-52" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-16 w-full rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed to load notices</AlertTitle>
          <AlertDescription>
            Could not retrieve your performance notices. Please refresh the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const notices = data?.notices ?? [];
  const unacknowledged = data?.unacknowledged_count ?? 0;
  const openNotices = notices.filter((n) => n.status === "open");
  const closedNotices = notices.filter((n) => n.status === "acknowledged");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-3">
          Performance Notices
          {unacknowledged > 0 && (
            <Badge variant="destructive" className="text-sm py-0.5 px-2">
              {unacknowledged} open
            </Badge>
          )}
        </h1>
        <p className="text-muted-foreground mt-1">
          Formal notices issued by the Managing Director regarding SLA compliance or quality
          standards.
        </p>
      </div>

      {/* Open notices alert */}
      {unacknowledged > 0 && (
        <Alert variant="destructive" className="border-red-300 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Action required</AlertTitle>
          <AlertDescription>
            You have {unacknowledged} unacknowledged notice
            {unacknowledged !== 1 ? "s" : ""}. Please review and acknowledge each one to confirm
            receipt.
          </AlertDescription>
        </Alert>
      )}

      {/* Empty state */}
      {notices.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-green-100 p-4 mb-4">
              <Bell className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold mb-1">No notices on record</h2>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              You have not received any formal performance notices. Keep up the great work!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Open notices */}
      {openNotices.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Open — requires acknowledgement
          </h2>
          {openNotices.map((notice) => (
            <NoticeCard key={notice.id} notice={notice} />
          ))}
        </div>
      )}

      {/* Acknowledged notices */}
      {closedNotices.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Acknowledged
          </h2>
          {closedNotices.map((notice) => (
            <NoticeCard key={notice.id} notice={notice} />
          ))}
        </div>
      )}
    </div>
  );
}
