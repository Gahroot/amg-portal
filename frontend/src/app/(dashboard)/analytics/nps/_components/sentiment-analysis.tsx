"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNPSSurveyStats } from "@/hooks/use-nps-surveys";
import { getNPSColor } from "./nps-utils";

function ScoreBar({
  label,
  percent,
  colorClass,
}: {
  label: string;
  percent: number;
  colorClass: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${colorClass}`}>
          {percent.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${colorClass.replace("text-", "bg-")}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}

interface SentimentAnalysisProps {
  surveyId: string;
}

export function SentimentAnalysis({ surveyId }: SentimentAnalysisProps) {
  const { data: stats, isLoading } = useNPSSurveyStats(surveyId);

  if (isLoading) {
    return (
      <p className="py-4 text-sm text-muted-foreground">Loading stats…</p>
    );
  }
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            NPS Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-3xl font-bold ${getNPSColor(stats.nps_score)}`}>
            {stats.nps_score}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Responses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{stats.total_responses}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats.response_rate.toFixed(0)}% response rate
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Score Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ScoreBar
            label="Promoters"
            percent={stats.promoters_percent}
            colorClass="text-green-600 dark:text-green-400"
          />
          <ScoreBar
            label="Passives"
            percent={stats.passives_percent}
            colorClass="text-amber-600 dark:text-amber-400"
          />
          <ScoreBar
            label="Detractors"
            percent={stats.detractors_percent}
            colorClass="text-red-600 dark:text-red-400"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Follow-Ups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{stats.follow_ups_pending}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats.follow_ups_completed} completed
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
