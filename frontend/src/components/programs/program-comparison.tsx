"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/programs/status-badge";
import { RagBadge } from "@/components/programs/rag-badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ProgramDetail } from "@/types/program";

interface ProgramComparisonProps {
  programs: ProgramDetail[];
}

interface ComparisonRow {
  label: string;
  getValue: (p: ProgramDetail) => React.ReactNode;
  highlightDifferences?: boolean;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value: number | string | null): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function valuesAreDifferent(programs: ProgramDetail[], getValue: (p: ProgramDetail) => React.ReactNode): boolean {
  const values = programs.map((p) => {
    const v = getValue(p);
    if (React.isValidElement(v)) return null; // Can't compare React elements
    return String(v ?? "");
  });
  if (values.some((v) => v === null)) return false;
  return new Set(values).size > 1;
}

export function ProgramComparison({ programs }: ProgramComparisonProps) {
  const rows: ComparisonRow[] = [
    {
      label: "Status",
      getValue: (p) => <StatusBadge status={p.status} />,
    },
    {
      label: "RAG Status",
      getValue: (p) => <RagBadge status={p.rag_status as "green" | "amber" | "red"} />,
    },
    {
      label: "Client",
      getValue: (p) => p.client_name || "—",
      highlightDifferences: true,
    },
    {
      label: "Start Date",
      getValue: (p) => formatDate(p.start_date),
      highlightDifferences: true,
    },
    {
      label: "End Date",
      getValue: (p) => formatDate(p.end_date),
      highlightDifferences: true,
    },
    {
      label: "Budget",
      getValue: (p) => formatCurrency(p.budget_envelope),
      highlightDifferences: true,
    },
    {
      label: "Milestones",
      getValue: (p) => `${p.completed_milestone_count} / ${p.milestone_count}`,
      highlightDifferences: true,
    },
    {
      label: "Progress",
      getValue: (p) => {
        const progress = p.milestone_count > 0 ? Math.round((p.completed_milestone_count / p.milestone_count) * 100) : 0;
        return (
          <div className="flex items-center gap-2">
            <Progress value={progress} className="h-2 w-20" />
            <span className="text-sm text-muted-foreground">{progress}%</span>
          </div>
        );
      },
    },
    {
      label: "Objectives",
      getValue: (p) => (
        <p className="text-sm leading-relaxed line-clamp-3">{p.objectives || "—"}</p>
      ),
    },
    {
      label: "Scope",
      getValue: (p) => (
        <p className="text-sm leading-relaxed line-clamp-3">{p.scope || "—"}</p>
      ),
    },
    {
      label: "Created",
      getValue: (p) => formatDate(p.created_at),
      highlightDifferences: true,
    },
  ];

  const colWidth = programs.length === 2 ? "w-1/2" : programs.length === 3 ? "w-1/3" : "w-1/4";

  return (
    <div className="space-y-6">
      {/* Header row with program names */}
      <div className="flex gap-4">
        <div className="w-40 shrink-0" />
        {programs.map((program) => (
          <Card key={program.id} className={cn("flex-1", colWidth)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{program.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{program.client_name}</p>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Comparison rows */}
      <Card>
        <CardContent className="p-0">
          {rows.map((row, index) => {
            const isDifferent = row.highlightDifferences && valuesAreDifferent(programs, row.getValue);
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
                  {programs.map((program) => (
                    <div key={program.id} className={cn("flex-1 text-sm", colWidth)}>
                      {row.getValue(program)}
                    </div>
                  ))}
                </div>
              </React.Fragment>
            );
          })}
        </CardContent>
      </Card>

      {/* Milestones detail comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="w-40 shrink-0" />
            {programs.map((program) => (
              <div key={program.id} className={cn("flex-1 space-y-2", colWidth)}>
                {program.milestones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No milestones</p>
                ) : (
                  program.milestones.map((ms) => (
                    <div key={ms.id} className="rounded-md border p-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{ms.title}</span>
                        <StatusBadge status={ms.status} />
                      </div>
                      {ms.due_date && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Due: {formatDate(ms.due_date)}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Tasks: {ms.completed_task_count}/{ms.task_count}
                      </p>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
