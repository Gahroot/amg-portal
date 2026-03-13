"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AccessAuditFinding } from "@/types/access-audit";

const SEVERITY_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  low: "secondary",
  medium: "default",
  high: "default",
  critical: "destructive",
};

interface AuditFindingTableProps {
  findings: AccessAuditFinding[];
  isCompleted?: boolean;
  onAcknowledge?: (findingId: string) => void;
  onRemediate?: (findingId: string) => void;
  onWaive?: (findingId: string) => void;
}

export function AuditFindingTable({
  findings,
  isCompleted = false,
  onAcknowledge,
  onRemediate,
  onWaive,
}: AuditFindingTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Description</TableHead>
            {!isCompleted && <TableHead>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {findings.map((finding) => (
            <TableRow key={finding.id}>
              <TableCell>
                <Badge variant="outline">
                  {finding.finding_type.replace(/_/g, " ")}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={SEVERITY_VARIANT[finding.severity] ?? "outline"}>
                  {finding.severity}
                </Badge>
              </TableCell>
              <TableCell>
                <StatusBadge status={finding.status} />
              </TableCell>
              <TableCell>
                {finding.user_name || finding.user_email || "-"}
              </TableCell>
              <TableCell className="max-w-xs truncate">
                {finding.description}
              </TableCell>
              {!isCompleted && (
                <TableCell>
                  <div className="flex gap-1">
                    {finding.status === "open" && onAcknowledge && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onAcknowledge(finding.id)}
                      >
                        Ack
                      </Button>
                    )}
                    {(finding.status === "open" ||
                      finding.status === "acknowledged") &&
                      onRemediate && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRemediate(finding.id)}
                        >
                          Remediate
                        </Button>
                      )}
                    {finding.status === "open" && onWaive && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onWaive(finding.id)}
                      >
                        Waive
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
          {findings.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={isCompleted ? 5 : 6}
                className="text-center text-muted-foreground"
              >
                No findings recorded.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
