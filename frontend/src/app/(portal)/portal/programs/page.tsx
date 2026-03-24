"use client";

import Link from "next/link";
import { usePortalPrograms } from "@/hooks/use-portal-programs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LayoutList } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  intake: "Intake",
  design: "Design",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  closed: "Closed",
  archived: "Archived",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  completed: "secondary",
  on_hold: "outline",
  intake: "outline",
  design: "outline",
  closed: "secondary",
  archived: "secondary",
};

const RAG_COLORS: Record<string, string> = {
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

const RAG_LABELS: Record<string, string> = {
  green: "On Track",
  amber: "At Risk",
  red: "Off Track",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PortalProgramsPage() {
  const { data: programs, isLoading } = usePortalPrograms();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="font-serif text-3xl font-bold tracking-tight">My Programs</h1>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (!programs || programs.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="font-serif text-3xl font-bold tracking-tight">My Programs</h1>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <LayoutList className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No programs found.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your programs will appear here once your relationship manager assigns them.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-serif text-3xl font-bold tracking-tight">My Programs</h1>
      <p className="text-muted-foreground">
        {programs.length} program{programs.length !== 1 ? "s" : ""} assigned to you
      </p>

      <div className="grid grid-cols-1 gap-4">
        {programs.map((program) => {
          const progress =
            program.milestone_count > 0
              ? Math.round((program.completed_milestone_count / program.milestone_count) * 100)
              : 0;

          return (
            <Link key={program.id} href={`/portal/programs/${program.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="font-serif text-lg leading-snug">
                      {program.title}
                    </CardTitle>
                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${RAG_COLORS[program.rag_status] ?? "bg-gray-400"}`}
                        title={RAG_LABELS[program.rag_status]}
                      />
                      <Badge variant={STATUS_VARIANTS[program.status] ?? "outline"}>
                        {STATUS_LABELS[program.status] ?? program.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Timeline */}
                  <div className="flex gap-6 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">Start: </span>
                      {formatDate(program.start_date)}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">End: </span>
                      {formatDate(program.end_date)}
                    </div>
                  </div>

                  {/* Milestone progress */}
                  {program.milestone_count > 0 ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Milestones: {program.completed_milestone_count} / {program.milestone_count}
                        </span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No milestones yet</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
