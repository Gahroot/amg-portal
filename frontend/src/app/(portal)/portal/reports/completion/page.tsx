"use client";

import Link from "next/link";
import { usePortfolioOverview } from "@/hooks/use-reports";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReportContainer } from "@/components/reports/report-container";
import { ReportStatusBadge } from "@/components/reports/report-container";

export default function CompletionReportsPage() {
  const { data: portfolio, isLoading } = usePortfolioOverview();

  const completedPrograms = portfolio?.programs.filter(
    (p) => p.status === "completed" || p.status === "closed"
  ) || [];

  if (isLoading) {
    return (
      <ReportContainer title="Completion Reports">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </ReportContainer>
    );
  }

  return (
    <ReportContainer
      title="Completion Reports"
      subtitle="View detailed reports for completed programs"
    >
      {completedPrograms.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No completed programs available yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {completedPrograms.map((program) => (
            <Link
              key={program.id}
              href={`/portal/reports/completion/${program.id}`}
              className="group"
            >
              <Card className="h-full transition-all hover:shadow-md hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="font-serif text-lg group-hover:text-primary transition-colors">
                      {program.title}
                    </CardTitle>
                    <ReportStatusBadge status={program.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Timeline</p>
                    <p className="text-sm">
                      {program.start_date && program.end_date
                        ? `${new Date(program.start_date).toLocaleDateString()} - ${new Date(program.end_date).toLocaleDateString()}`
                        : "Dates not set"}
                    </p>
                  </div>
                  {program.budget_envelope && (
                    <div>
                      <p className="text-sm text-muted-foreground">Budget</p>
                      <p className="text-sm font-medium">
                        ${program.budget_envelope.toLocaleString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Milestone Progress</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${program.milestone_progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {program.milestone_progress.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </ReportContainer>
  );
}
