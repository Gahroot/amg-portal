"use client";

import { use } from "react";
import Link from "next/link";
import { usePortalProgram } from "@/hooks/use-portal-programs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Circle, Clock, XCircle } from "lucide-react";
import { ProgramTimeline } from "@/components/programs/program-timeline";

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

const MILESTONE_STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  in_progress: <Clock className="h-4 w-4 text-amber-500" />,
  cancelled: <XCircle className="h-4 w-4 text-muted-foreground" />,
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
};

const MILESTONE_STATUS_LABELS: Record<string, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  cancelled: "Cancelled",
  pending: "Pending",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PortalProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: program, isLoading } = usePortalProgram(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/portal/programs">
          <Button variant="ghost" size="sm" className="gap-1 pl-0">
            <ArrowLeft className="h-4 w-4" /> Back to Programs
          </Button>
        </Link>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/portal/programs">
          <Button variant="ghost" size="sm" className="gap-1 pl-0">
            <ArrowLeft className="h-4 w-4" /> Back to Programs
          </Button>
        </Link>
        <p className="text-muted-foreground">Program not found.</p>
      </div>
    );
  }

  const progress =
    program.milestone_count > 0
      ? Math.round((program.completed_milestone_count / program.milestone_count) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back link */}
      <Link href="/portal/programs">
        <Button variant="ghost" size="sm" className="gap-1 pl-0">
          <ArrowLeft className="h-4 w-4" /> Back to Programs
        </Button>
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-serif text-3xl font-bold tracking-tight">{program.title}</h1>
        <div className="flex items-center gap-2 shrink-0">
          <div
            className={`w-3 h-3 rounded-full ${RAG_COLORS[program.rag_status] ?? "bg-gray-400"}`}
            title={RAG_LABELS[program.rag_status]}
          />
          <Badge variant={STATUS_VARIANTS[program.status] ?? "outline"}>
            {STATUS_LABELS[program.status] ?? program.status}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">
            Timeline
          </TabsTrigger>
          <TabsTrigger value="milestones">
            Milestones ({program.milestone_count})
          </TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Start</span>
                  <span>{formatDate(program.start_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">End</span>
                  <span>{formatDate(program.end_date)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Health Status
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-full shrink-0 ${RAG_COLORS[program.rag_status] ?? "bg-gray-400"}`}
                />
                <span className="text-sm font-medium">
                  {RAG_LABELS[program.rag_status] ?? program.rag_status}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Milestone progress card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Milestone Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {program.milestone_count > 0 ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {program.completed_milestone_count} of {program.milestone_count} completed
                    </span>
                    <span className="font-semibold">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2.5" />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No milestones defined yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Objectives */}
          {program.objectives && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Objectives
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{program.objectives}</p>
              </CardContent>
            </Card>
          )}

          {/* Scope */}
          {program.scope && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Scope</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{program.scope}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Timeline tab */}
        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Program Journey
                </CardTitle>
                {program.milestone_count > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {program.completed_milestone_count} of {program.milestone_count} milestones complete
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              {program.milestone_count > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                    <span>{progress}% complete</span>
                    <span>
                      {formatDate(program.start_date)} → {formatDate(program.end_date)}
                    </span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              )}
              <ProgramTimeline program={program} variant="full" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Milestones tab */}
        <TabsContent value="milestones" className="mt-4">
          {program.milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No milestones defined yet.</p>
          ) : (
            <div className="space-y-3">
              {program.milestones.map((milestone) => (
                <Card key={milestone.id}>
                  <CardContent className="flex items-start gap-3 py-4">
                    <div className="mt-0.5">
                      {MILESTONE_STATUS_ICONS[milestone.status] ?? (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{milestone.title}</p>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {MILESTONE_STATUS_LABELS[milestone.status] ?? milestone.status}
                        </Badge>
                      </div>
                      {milestone.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                          {milestone.description}
                        </p>
                      )}
                      {milestone.due_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Due: {formatDate(milestone.due_date)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
