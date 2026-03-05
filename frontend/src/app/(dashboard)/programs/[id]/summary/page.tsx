"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getProgramSummary } from "@/lib/api/programs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/programs/status-badge";

export default function ProgramSummaryPage() {
  const params = useParams();
  const programId = params.id as string;

  const { data: program, isLoading } = useQuery({
    queryKey: ["program-summary", programId],
    queryFn: () => getProgramSummary(programId),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground text-sm">Loading summary...</p>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground">Program not found.</p>
        </div>
      </div>
    );
  }

  const overallProgress = Math.round(program.milestone_progress);

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            {program.title}
          </h1>
          <StatusBadge status={program.status} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Overall Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={overallProgress} />
            <p className="mt-2 text-sm text-muted-foreground">
              {overallProgress}% milestones completed
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Start Date</p>
              <p className="font-medium">
                {program.start_date
                  ? new Date(program.start_date).toLocaleDateString()
                  : "-"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">End Date</p>
              <p className="font-medium">
                {program.end_date
                  ? new Date(program.end_date).toLocaleDateString()
                  : "-"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Milestones</p>
              <p className="font-medium">
                {program.milestones.length} total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="mt-1">
                <StatusBadge status={program.status} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <h2 className="font-serif text-xl font-semibold">Milestones</h2>
          {program.milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No milestones defined.
            </p>
          ) : (
            program.milestones.map((milestone, idx) => (
              <Card key={idx}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{milestone.title}</p>
                    <StatusBadge status={milestone.status} />
                  </div>
                  {milestone.due_date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Due: {new Date(milestone.due_date).toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
