"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProgramHealthItem } from "@/lib/api/dashboard";

function RAGBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    red: "bg-red-100 text-red-800 border-red-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    green: "bg-green-100 text-green-800 border-green-200",
  };

  return (
    <Badge variant="outline" className={variants[status] ?? ""}>
      {status.toUpperCase()}
    </Badge>
  );
}

interface ProgramHealthTableProps {
  programs: ProgramHealthItem[];
}

export function ProgramHealthTable({ programs }: ProgramHealthTableProps) {
  if (programs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No programs found.
      </p>
    );
  }

  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Program</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>RAG</TableHead>
            <TableHead>Milestone Progress</TableHead>
            <TableHead className="text-right">Escalations</TableHead>
            <TableHead className="text-right">SLA Breaches</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {programs.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.title}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {p.client_name}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{p.status}</Badge>
              </TableCell>
              <TableCell>
                <RAGBadge status={p.rag_status} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress
                    value={p.milestone_progress}
                    className="h-2 w-24"
                  />
                  <span className="text-xs text-muted-foreground">
                    {p.completed_milestone_count}/{p.milestone_count} (
                    {p.milestone_progress.toFixed(0)}%)
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                {p.active_escalation_count > 0 ? (
                  <Badge variant="destructive">
                    {p.active_escalation_count}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {p.sla_breach_count > 0 ? (
                  <Badge variant="destructive">{p.sla_breach_count}</Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">0</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
