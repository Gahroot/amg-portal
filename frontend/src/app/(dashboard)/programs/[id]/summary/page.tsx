"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Printer, ArrowLeft } from "lucide-react";
import { getProgramSummary } from "@/lib/api/programs";
import { useProgram } from "@/hooks/use-programs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/programs/status-badge";

function RagBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    green: {
      label: "On Track",
      className: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200",
    },
    amber: {
      label: "At Risk",
      className: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200",
    },
    red: {
      label: "Off Track",
      className: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200",
    },
  };
  const cfg = map[status] ?? { label: status, className: "" };
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ProgramSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const programId = params.id as string;

  const { data: program, isLoading: programLoading } = useProgram(programId);
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["program-summary", programId],
    queryFn: () => getProgramSummary(programId),
  });

  const isLoading = programLoading || summaryLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-muted-foreground text-sm">Loading summary...</p>
        </div>
      </div>
    );
  }

  if (!program || !summary) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-muted-foreground">Program not found.</p>
        </div>
      </div>
    );
  }

  const overallProgress = Math.round(summary.milestone_progress);
  const completedMilestones = summary.milestones.filter(
    (m) => m.status === "completed"
  ).length;
  const overdueMilestones = summary.milestones.filter((m) => {
    if (!m.due_date || m.status === "completed") return false;
    return new Date(m.due_date) < new Date();
  }).length;

  return (
    <div className="min-h-screen bg-background p-8 print:p-0 print:bg-white">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Toolbar (hidden when printing) */}
        <div className="flex items-center justify-between print:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/programs/${programId}`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Program
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print Summary
          </Button>
        </div>

        {/* Header */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              {program.title}
            </h1>
            <StatusBadge status={program.status} />
            <RagBadge status={program.rag_status} />
          </div>
          <p className="text-muted-foreground">
            Client:{" "}
            <span className="font-medium text-foreground">{program.client_name}</span>
          </p>
          <p className="text-xs text-muted-foreground print:block hidden">
            Generated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        <Separator />

        {/* Key Dates & Metrics */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Start Date</p>
              <p className="font-medium text-sm">{formatDate(program.start_date)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">End Date</p>
              <p className="font-medium text-sm">{formatDate(program.end_date)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Milestones</p>
              <p className="font-medium text-sm">
                {completedMilestones} / {summary.milestones.length} complete
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className={`font-medium text-sm ${overdueMilestones > 0 ? "text-destructive" : ""}`}>
                {overdueMilestones} milestone{overdueMilestones !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Budget */}
        {program.budget_envelope && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">Budget Envelope</p>
              <p className="font-medium">{program.budget_envelope}</p>
            </CardContent>
          </Card>
        )}

        {/* Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overall Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={overallProgress} />
            <p className="text-sm text-muted-foreground">
              {overallProgress}% of milestones completed
            </p>
          </CardContent>
        </Card>

        {/* Objectives */}
        {program.objectives && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Objectives</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{program.objectives}</p>
            </CardContent>
          </Card>
        )}

        {/* Milestones */}
        <div className="space-y-3">
          <h2 className="font-serif text-xl font-semibold">Milestones</h2>
          {summary.milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground">No milestones defined.</p>
          ) : (
            <div className="space-y-2">
              {summary.milestones.map((milestone, idx) => {
                const isOverdue =
                  milestone.due_date &&
                  milestone.status !== "completed" &&
                  new Date(milestone.due_date) < new Date();
                return (
                  <Card key={idx}>
                    <CardContent className="flex items-center justify-between py-3 px-4">
                      <div>
                        <p className="font-medium text-sm">{milestone.title}</p>
                        {milestone.due_date && (
                          <p
                            className={`text-xs mt-0.5 ${
                              isOverdue
                                ? "text-destructive font-medium"
                                : "text-muted-foreground"
                            }`}
                          >
                            Due: {formatDate(milestone.due_date)}
                            {isOverdue && " — Overdue"}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={milestone.status} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
