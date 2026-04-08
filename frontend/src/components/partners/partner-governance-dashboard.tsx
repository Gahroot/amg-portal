"use client";

import { useQuery } from "@tanstack/react-query";
import { getGovernanceDashboard } from "@/lib/api/partner-governance";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 70) return "text-green-700 dark:text-green-300";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function statusBadgeVariant(
  action: string | null,
): "default" | "secondary" | "destructive" | "outline" {
  if (!action) return "default";
  if (action === "warning") return "secondary";
  if (action === "probation") return "outline";
  if (action === "reinstatement") return "default";
  return "destructive";
}

const ACTION_LABELS: Record<string, string> = {
  warning: "Warning",
  probation: "Probation",
  suspension: "Suspended",
  termination: "Terminated",
  reinstatement: "Reinstated",
};

export function PartnerGovernanceDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["governance-dashboard"],
    queryFn: () => getGovernanceDashboard({ limit: 100 }),
  });

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading governance dashboard...
      </p>
    );
  }

  const entries = data?.entries ?? [];

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Partner</TableHead>
            <TableHead>Composite Score</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>SLA Breaches</TableHead>
            <TableHead>Avg Rating</TableHead>
            <TableHead>Notices</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.partner_id}>
              <TableCell className="font-medium">
                <Link
                  href={`/partners/${entry.partner_id}`}
                  className="hover:underline"
                >
                  {entry.firm_name}
                </Link>
              </TableCell>
              <TableCell>
                <span
                  className={`font-semibold ${scoreColor(entry.composite_score)}`}
                >
                  {entry.composite_score !== null
                    ? entry.composite_score.toFixed(1)
                    : "–"}
                </span>
              </TableCell>
              <TableCell>
                {entry.current_action ? (
                  <Badge
                    variant={statusBadgeVariant(entry.current_action)}
                  >
                    {ACTION_LABELS[entry.current_action] ??
                      entry.current_action}
                  </Badge>
                ) : (
                  <Badge variant="default">Good Standing</Badge>
                )}
              </TableCell>
              <TableCell>
                <span
                  className={
                    entry.sla_breach_count > 0
                      ? "text-red-600 dark:text-red-400 font-medium"
                      : ""
                  }
                >
                  {entry.sla_breach_count}
                </span>
              </TableCell>
              <TableCell>
                {entry.avg_rating !== null
                  ? entry.avg_rating.toFixed(2)
                  : "–"}
              </TableCell>
              <TableCell>{entry.notice_count}</TableCell>
            </TableRow>
          ))}
          {entries.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-muted-foreground"
              >
                No partners found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
