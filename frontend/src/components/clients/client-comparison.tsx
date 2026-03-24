"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ClientProfile } from "@/types/client";

interface ClientComparisonProps {
  clients: ClientProfile[];
}

interface ComparisonRow {
  label: string;
  getValue: (c: ClientProfile) => React.ReactNode;
  highlightDifferences?: boolean;
}

const COMPLIANCE_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  cleared: "default",
  pending_review: "secondary",
  under_review: "secondary",
  flagged: "destructive",
  rejected: "destructive",
};

const APPROVAL_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  approved: "default",
  pending_compliance: "secondary",
  compliance_cleared: "secondary",
  pending_md_approval: "secondary",
  flagged: "destructive",
  rejected: "destructive",
  draft: "outline",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatLabel(value: string | null): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function valuesAreDifferent(clients: ClientProfile[], getValue: (c: ClientProfile) => React.ReactNode): boolean {
  const values = clients.map((c) => {
    const v = getValue(c);
    if (React.isValidElement(v)) return null;
    return String(v ?? "");
  });
  if (values.some((v) => v === null)) return false;
  return new Set(values).size > 1;
}

export function ClientComparison({ clients }: ClientComparisonProps) {
  const rows: ComparisonRow[] = [
    {
      label: "Entity Type",
      getValue: (c) => formatLabel(c.entity_type),
      highlightDifferences: true,
    },
    {
      label: "Jurisdiction",
      getValue: (c) => c.jurisdiction || "—",
      highlightDifferences: true,
    },
    {
      label: "Compliance Status",
      getValue: (c) => (
        <Badge variant={COMPLIANCE_STATUS_VARIANT[c.compliance_status] ?? "outline"}>
          {c.compliance_status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      label: "Approval Status",
      getValue: (c) => (
        <Badge variant={APPROVAL_STATUS_VARIANT[c.approval_status] ?? "outline"}>
          {c.approval_status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      label: "Security Level",
      getValue: (c) => formatLabel(c.security_profile_level),
      highlightDifferences: true,
    },
    {
      label: "Primary Email",
      getValue: (c) => c.primary_email,
      highlightDifferences: true,
    },
    {
      label: "Phone",
      getValue: (c) => c.phone || "—",
      highlightDifferences: true,
    },
    {
      label: "Address",
      getValue: (c) => (
        <p className="text-sm leading-relaxed line-clamp-2">{c.address || "—"}</p>
      ),
    },
    {
      label: "Communication",
      getValue: (c) => formatLabel(c.communication_preference),
      highlightDifferences: true,
    },
    {
      label: "Portal Access",
      getValue: (c) => (
        <Badge variant={c.portal_access_enabled ? "default" : "outline"}>
          {c.portal_access_enabled ? "Enabled" : "Disabled"}
        </Badge>
      ),
    },
    {
      label: "Welcome Email",
      getValue: (c) => (c.welcome_email_sent ? "Sent" : "Not sent"),
      highlightDifferences: true,
    },
    {
      label: "Compliance Reviewed",
      getValue: (c) => formatDate(c.compliance_reviewed_at),
      highlightDifferences: true,
    },
    {
      label: "Approved At",
      getValue: (c) => formatDate(c.approved_at),
      highlightDifferences: true,
    },
    {
      label: "Created",
      getValue: (c) => formatDate(c.created_at),
      highlightDifferences: true,
    },
  ];

  const colWidth = clients.length === 2 ? "w-1/2" : clients.length === 3 ? "w-1/3" : "w-1/4";

  return (
    <div className="space-y-6">
      {/* Header row with client names */}
      <div className="flex gap-4">
        <div className="w-40 shrink-0" />
        {clients.map((client) => (
          <Card key={client.id} className={cn("flex-1", colWidth)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                {client.display_name || client.legal_name}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {client.entity_type ? formatLabel(client.entity_type) : "—"} · {client.jurisdiction || "—"}
              </p>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Comparison rows */}
      <Card>
        <CardContent className="p-0">
          {rows.map((row, index) => {
            const isDifferent = row.highlightDifferences && valuesAreDifferent(clients, row.getValue);
            return (
              <React.Fragment key={row.label}>
                {index > 0 && <Separator />}
                <div
                  className={cn(
                    "flex items-start gap-4 px-4 py-3",
                    isDifferent && "bg-amber-50/50"
                  )}
                >
                  <div className="w-40 shrink-0 pt-0.5">
                    <span className="text-sm font-medium text-muted-foreground">
                      {row.label}
                    </span>
                    {isDifferent && (
                      <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" title="Values differ" />
                    )}
                  </div>
                  {clients.map((client) => (
                    <div key={client.id} className={cn("flex-1 text-sm", colWidth)}>
                      {row.getValue(client)}
                    </div>
                  ))}
                </div>
              </React.Fragment>
            );
          })}
        </CardContent>
      </Card>

      {/* Sensitivities & Special Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Notes & Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-40 shrink-0">
                <span className="text-sm font-medium text-muted-foreground">Sensitivities</span>
              </div>
              {clients.map((client) => (
                <div key={client.id} className={cn("flex-1 text-sm", colWidth)}>
                  <p className="leading-relaxed">{client.sensitivities || "—"}</p>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex gap-4">
              <div className="w-40 shrink-0">
                <span className="text-sm font-medium text-muted-foreground">Special Instructions</span>
              </div>
              {clients.map((client) => (
                <div key={client.id} className={cn("flex-1 text-sm", colWidth)}>
                  <p className="leading-relaxed">{client.special_instructions || "—"}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
