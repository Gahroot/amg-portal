"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AccessAudit } from "@/types/access-audit";

interface AccessAuditCardProps {
  audit: AccessAudit;
}

export function AccessAuditCard({ audit }: AccessAuditCardProps) {
  const router = useRouter();
  const openFindings = audit.findings.filter((f) =>
    ["open", "acknowledged", "in_progress"].includes(f.status)
  ).length;

  return (
    <div
      className="cursor-pointer rounded-lg border bg-white p-5 transition-shadow hover:shadow-md"
      onClick={() => router.push(`/access-audits/${audit.id}`)}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="font-medium">{audit.audit_period}</h3>
          <p className="text-sm text-muted-foreground">
            Q{audit.quarter} {audit.year}
          </p>
        </div>
        <StatusBadge status={audit.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground">Auditor</p>
          <p className="font-medium">{audit.auditor_name || "Unassigned"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Users Reviewed</p>
          <p className="font-medium">{audit.users_reviewed}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Total Findings</p>
          <p className="font-medium">{audit.anomalies_found}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Open Findings</p>
          <p className={`font-medium ${openFindings > 0 ? "text-yellow-600" : "text-green-600"}`}>
            {openFindings}
          </p>
        </div>
      </div>

      {audit.completed_at && (
        <p className="mt-3 text-xs text-muted-foreground">
          Completed: {new Date(audit.completed_at).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
