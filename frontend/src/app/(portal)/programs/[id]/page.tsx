"use client";

import { use } from "react";
import Link from "next/link";
import { usePortalProgramDetail } from "@/hooks/use-clients";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Circle,
  Clock,
  FileText,
} from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  intake: "bg-slate-100 text-slate-700",
  design: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  on_hold: "bg-yellow-100 text-yellow-700",
  completed: "bg-emerald-100 text-emerald-700",
  closed: "bg-gray-100 text-gray-700",
  archived: "bg-gray-100 text-gray-500",
};

const MILESTONE_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  completed: CheckCircle,
  in_progress: Clock,
  pending: Circle,
  cancelled: Circle,
};

const RAG_COLORS: Record<string, string> = {
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

export default function PortalProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: program, isLoading } = usePortalProgramDetail(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-muted-foreground text-sm">Loading program...</p>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/portal/programs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Programs
          </Button>
        </Link>
        <p className="text-muted-foreground">Program not found.</p>
      </div>
    );
  }

  const progress =
    program.milestone_count > 0
      ? Math.round(
          (program.completed_milestone_count / program.milestone_count) * 100
        )
      : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back link */}
      <Link href="/portal/programs">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Programs
        </Button>
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            {program.title}
          </h1>
          {program.objectives && (
            <p className="mt-2 text-muted-foreground">{program.objectives}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`h-3 w-3 rounded-full ${RAG_COLORS[program.rag_status]}`}
            title={`RAG: ${program.rag_status}`}
          />
          <Badge
            className={STATUS_COLORS[program.status] || ""}
            variant="secondary"
          >
            {program.status.replace(/_/g, " ")}
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overall Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{progress}%</p>
            <Progress value={progress} className="mt-2 h-2" />
            <p className="mt-1 text-xs text-muted-foreground">
              {program.completed_milestone_count} of {program.milestone_count}{" "}
              milestones completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {program.start_date
                ? format(new Date(program.start_date), "MMM d, yyyy")
                : "Not set"}
            </div>
            {program.end_date && (
              <div className="mt-1 text-sm text-muted-foreground">
                → {format(new Date(program.end_date), "MMM d, yyyy")}
              </div>
            )}
          </CardContent>
        </Card>

        {program.scope && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Scope
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{program.scope}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Milestones Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          {program.milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No milestones defined yet.
            </p>
          ) : (
            <div className="space-y-4">
              {program.milestones.map((milestone, index) => {
                const Icon =
                  MILESTONE_ICONS[milestone.status] || Circle;
                const isCompleted = milestone.status === "completed";
                const isLast = index === program.milestones.length - 1;

                return (
                  <div key={milestone.id} className="flex gap-3">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <Icon
                        className={`h-5 w-5 flex-shrink-0 ${
                          isCompleted
                            ? "text-green-500"
                            : milestone.status === "in_progress"
                              ? "text-blue-500"
                              : "text-muted-foreground"
                        }`}
                      />
                      {!isLast && (
                        <div
                          className={`w-0.5 flex-1 mt-1 ${
                            isCompleted ? "bg-green-300" : "bg-muted"
                          }`}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between">
                        <p
                          className={`text-sm font-medium ${
                            isCompleted ? "text-muted-foreground line-through" : ""
                          }`}
                        >
                          {milestone.title}
                        </p>
                        <Badge variant="outline" className="text-xs capitalize">
                          {milestone.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      {milestone.description && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {milestone.description}
                        </p>
                      )}
                      {milestone.due_date && (
                        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due:{" "}
                          {format(
                            new Date(milestone.due_date),
                            "MMM d, yyyy"
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client-Visible Deliverables */}
      {program.deliverables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Deliverables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {program.deliverables.map((deliverable) => (
                <div
                  key={deliverable.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {deliverable.title}
                      </p>
                      {deliverable.description && (
                        <p className="text-xs text-muted-foreground">
                          {deliverable.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {deliverable.due_date && (
                      <span className="text-xs text-muted-foreground">
                        {format(
                          new Date(deliverable.due_date),
                          "MMM d, yyyy"
                        )}
                      </span>
                    )}
                    <Badge variant="outline" className="text-xs capitalize">
                      {deliverable.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
