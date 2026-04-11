"use client";

import { Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface InsightsCardProps {
  insights: string[] | undefined;
}

export function InsightsCard({ insights }: InsightsCardProps) {
  if (!insights?.length) return null;
  return (
    <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-base flex items-center gap-2 text-amber-800 dark:text-amber-300">
          <Lightbulb className="h-4 w-4" />
          Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {insights.map((insight, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-300"
            >
              <span className="mt-0.5 h-2 w-2 rounded-full bg-amber-400 shrink-0" />
              {insight}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
