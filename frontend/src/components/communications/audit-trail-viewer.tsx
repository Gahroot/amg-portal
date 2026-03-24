"use client";

import * as React from "react";
import { useCommunicationAuditTrail, useCommunicationAuditSearch } from "@/hooks/use-communication-audit";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CommunicationAuditRecord, CommunicationAuditSearchParams } from "@/types/communication-audit";

const ACTION_LABELS: Record<string, string> = {
  created: "Created",
  sent: "Sent",
  viewed: "Viewed",
  replied: "Replied",
  forwarded: "Forwarded",
  archived: "Archived",
  deleted: "Deleted",
  status_changed: "Status Changed",
};

const ACTION_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  created: "outline",
  sent: "default",
  viewed: "secondary",
  replied: "default",
  forwarded: "secondary",
  archived: "secondary",
  deleted: "destructive",
  status_changed: "outline",
};

function AuditEntry({ entry }: { entry: CommunicationAuditRecord }) {
  const date = new Date(entry.created_at);
  return (
    <div className="flex items-start gap-4 border-l-2 border-muted pl-4 pb-6 relative">
      <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" />
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant={ACTION_COLORS[entry.action] ?? "outline"}>
            {ACTION_LABELS[entry.action] ?? entry.action}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {date.toLocaleDateString()} {date.toLocaleTimeString()}
          </span>
        </div>
        <p className="text-sm">
          <span className="font-medium">{entry.actor_name ?? "Unknown"}</span>
          {entry.actor_email && (
            <span className="text-muted-foreground"> ({entry.actor_email})</span>
          )}
        </p>
        {entry.details && Object.keys(entry.details).length > 0 && (
          <div className="mt-1 rounded bg-muted/50 p-2 text-xs font-mono">
            {Object.entries(entry.details).map(([key, value]) => (
              <div key={key}>
                <span className="text-muted-foreground">{key}:</span>{" "}
                {typeof value === "object" ? JSON.stringify(value) : String(value)}
              </div>
            ))}
          </div>
        )}
        {entry.ip_address && (
          <p className="text-xs text-muted-foreground">IP: {entry.ip_address}</p>
        )}
      </div>
    </div>
  );
}

interface AuditTrailViewerProps {
  communicationId?: string;
  searchParams?: CommunicationAuditSearchParams;
  title?: string;
}

export function AuditTrailViewer({
  communicationId,
  searchParams,
  title = "Audit Trail",
}: AuditTrailViewerProps) {
  const trailQuery = useCommunicationAuditTrail(communicationId ?? "", {
    skip: 0,
    limit: 100,
  });
  const searchQuery = useCommunicationAuditSearch(
    communicationId ? undefined : searchParams
  );

  const query = communicationId ? trailQuery : searchQuery;
  const audits = query.data?.audits ?? [];
  const total = query.data?.total ?? 0;

  if (query.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading audit trail...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {total} {total === 1 ? "entry" : "entries"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {audits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit entries found.</p>
        ) : (
          <div className="space-y-0">
            {audits.map((entry) => (
              <AuditEntry key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
