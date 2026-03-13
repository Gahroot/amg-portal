"use client";

import Link from "next/link";
import { usePortalPrograms } from "@/hooks/use-clients";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Calendar } from "lucide-react";
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

const RAG_COLORS: Record<string, string> = {
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

export default function PortalProgramsPage() {
  const { data, isLoading } = usePortalPrograms();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-muted-foreground text-sm">Loading programs...</p>
      </div>
    );
  }

  if (!data || data.programs.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="font-serif text-3xl font-bold tracking-tight">Programs</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No programs found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-serif text-3xl font-bold tracking-tight">Programs</h1>

      <div className="grid grid-cols-1 gap-4">
        {data.programs.map((program) => {
          const progress =
            program.milestone_count > 0
              ? Math.round(
                  (program.completed_milestone_count / program.milestone_count) *
                    100
                )
              : 0;

          return (
            <Link key={program.id} href={`/portal/programs/${program.id}`}>
              <Card className="transition-shadow hover:shadow-md cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="font-serif text-lg">
                        {program.title}
                      </CardTitle>
                      {program.objectives && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {program.objectives}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
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
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Milestone Progress */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">
                          Milestone Progress
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {program.completed_milestone_count}/{program.milestone_count}{" "}
                          ({progress}%)
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    {/* Dates & Action */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {program.start_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(program.start_date), "MMM d, yyyy")}
                          </span>
                        )}
                        {program.end_date && (
                          <span>
                            → {format(new Date(program.end_date), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                      <span className="flex items-center text-xs text-primary">
                        View Details <ArrowRight className="ml-1 h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
