"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { getAuditLog } from "@/lib/api/audit-logs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ALLOWED_ROLES = ["finance_compliance", "managing_director"];

const ACTION_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  create: "default",
  update: "secondary",
  delete: "destructive",
};

function JsonDiff({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  const allKeys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">Before</h3>
        <pre className="rounded-md border bg-muted/50 p-4 text-xs overflow-auto max-h-[500px]">
          {before
            ? Array.from(allKeys)
                .sort()
                .map((key) => {
                  const val = before[key];
                  const changed =
                    after !== null &&
                    key in (after ?? {}) &&
                    JSON.stringify(val) !== JSON.stringify(after[key]);
                  return (
                    <div
                      key={key}
                      className={changed ? "bg-red-100 dark:bg-red-900/30 -mx-4 px-4" : ""}
                    >
                      <span className="text-muted-foreground">{key}: </span>
                      {JSON.stringify(val, null, 2)}
                    </div>
                  );
                })
            : "—"}
        </pre>
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-2">After</h3>
        <pre className="rounded-md border bg-muted/50 p-4 text-xs overflow-auto max-h-[500px]">
          {after
            ? Array.from(allKeys)
                .sort()
                .map((key) => {
                  const val = after[key];
                  const changed =
                    before !== null &&
                    key in (before ?? {}) &&
                    JSON.stringify(val) !==
                      JSON.stringify(before[key]);
                  return (
                    <div
                      key={key}
                      className={changed ? "bg-green-100 dark:bg-green-900/30 -mx-4 px-4" : ""}
                    >
                      <span className="text-muted-foreground">{key}: </span>
                      {JSON.stringify(val, null, 2)}
                    </div>
                  );
                })
            : "—"}
        </pre>
      </div>
    </div>
  );
}

export default function AuditLogDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: log, isLoading } = useQuery({
    queryKey: ["audit-log", id],
    queryFn: () => getAuditLog(id),
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (!log) {
    return (
      <div className="min-h-screen bg-background p-8">
        <p className="text-muted-foreground">Audit log not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            Back
          </Button>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Audit Log Detail
          </h1>
        </div>

        <div className="rounded-md border bg-card p-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">ID</span>
              <p className="font-mono">{log.id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Timestamp</span>
              <p>{new Date(log.created_at).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Action</span>
              <p>
                <Badge variant={ACTION_VARIANT[log.action] ?? "outline"}>
                  {log.action}
                </Badge>
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">User</span>
              <p>{log.user_email || "system"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Entity Type</span>
              <p>
                <Badge variant="outline">
                  {log.entity_type.replace(/_/g, " ")}
                </Badge>
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Entity ID</span>
              <p className="font-mono text-xs">{log.entity_id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">IP Address</span>
              <p>{log.ip_address || "—"}</p>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">User Agent</span>
              <p className="text-xs truncate">{log.user_agent || "—"}</p>
            </div>
          </div>
        </div>

        <div className="rounded-md border bg-card p-6">
          <h2 className="font-serif text-xl font-semibold mb-4">
            State Changes
          </h2>
          <JsonDiff before={log.before_state} after={log.after_state} />
        </div>
      </div>
    </div>
  );
}
