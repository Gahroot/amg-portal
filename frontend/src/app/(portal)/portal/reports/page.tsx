"use client";

import Link from "next/link";
import { usePortfolioOverview } from "@/hooks/use-reports";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReportContainer, ReportMetric, ReportStatusBadge } from "@/components/reports/report-container";

export default function ReportsIndexPage() {
  const { data: portfolio, isLoading } = usePortfolioOverview();

  if (isLoading) {
    return (
      <ReportContainer title="Reports">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </ReportContainer>
    );
  }

  if (!portfolio) {
    return (
      <ReportContainer title="Reports">
        <p className="text-muted-foreground">No data available.</p>
      </ReportContainer>
    );
  }

  const currentYear = new Date().getFullYear();

  return (
    <ReportContainer title="Reports" subtitle="View your program reports and analytics">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Portfolio Overview Card */}
        <Link href="/portal/reports/portfolio" className="group">
          <Card className="h-full transition-all hover:shadow-md hover:border-primary/50">
            <CardHeader>
              <CardTitle className="font-serif text-lg group-hover:text-primary transition-colors">
                Portfolio Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ReportMetric label="Total Programs" value={portfolio.total_programs} />
              <ReportMetric label="Active Programs" value={portfolio.active_programs} />
              <div className="pt-2">
                <p className="text-sm text-muted-foreground">Overall Progress</p>
                <div className="mt-2 h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${portfolio.overall_milestone_progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {portfolio.overall_milestone_progress.toFixed(1)}%
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Program Status Card */}
        <Link href="/portal/reports/program-status" className="group">
          <Card className="h-full transition-all hover:shadow-md hover:border-primary/50">
            <CardHeader>
              <CardTitle className="font-serif text-lg group-hover:text-primary transition-colors">
                Program Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                View active milestones, completed deliverables, and pending decisions for any
                program.
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                Select a program to view detailed status report.
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Completion Reports Card */}
        <Link href="/portal/reports/completion" className="group">
          <Card className="h-full transition-all hover:shadow-md hover:border-primary/50">
            <CardHeader>
              <CardTitle className="font-serif text-lg group-hover:text-primary transition-colors">
                Completion Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Access detailed completion reports for finished programs including timeline
                adherence and deliverables.
              </p>
              {portfolio.completed_programs > 0 ? (
                <p className="text-xs text-muted-foreground mt-4">
                  {portfolio.completed_programs} completed program(s) available
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-4">
                  No completed programs yet
                </p>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Annual Review Card */}
        <Link href={`/portal/reports/annual/${currentYear}`} className="group">
          <Card className="h-full transition-all hover:shadow-md hover:border-primary/50">
            <CardHeader>
              <CardTitle className="font-serif text-lg group-hover:text-primary transition-colors">
                Annual Review
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Year-in-review across all programs with strategic insights and partner
                performance.
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                View {currentYear} annual summary
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Quick Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <ReportMetric label="Total Budget" value={`$${(portfolio.total_budget || 0).toLocaleString()}`} />
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">RAG Status</p>
              <div className="flex gap-2">
                {portfolio.rag_summary.red > 0 && (
                  <ReportStatusBadge status="red" />
                )}
                {portfolio.rag_summary.amber > 0 && (
                  <ReportStatusBadge status="amber" />
                )}
                {portfolio.rag_summary.green > 0 && (
                  <ReportStatusBadge status="green" />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </ReportContainer>
  );
}
