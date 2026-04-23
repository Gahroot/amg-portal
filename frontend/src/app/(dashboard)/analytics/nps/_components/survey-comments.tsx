"use client";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNPSResponses } from "@/hooks/use-nps-surveys";
import { isNPSScoreCategory } from "@/lib/type-guards";
import type { NPSSurvey, NPSScoreCategory } from "@/types/nps-survey";

const SCORE_CATEGORY_VARIANT: Record<
  NPSScoreCategory,
  "default" | "secondary" | "destructive" | "outline"
> = {
  promoter: "default",
  passive: "secondary",
  detractor: "destructive",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function truncateId(id: string): string {
  return id.slice(0, 8) + "…";
}

interface SurveyCommentsProps {
  surveys: NPSSurvey[];
  selectedSurveyId: string | null;
  onSelectSurvey: (id: string) => void;
}

export function SurveyComments({
  surveys,
  selectedSurveyId,
  onSelectSurvey,
}: SurveyCommentsProps) {
  const { data, isLoading } = useNPSResponses(selectedSurveyId ?? "");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h2 className="font-serif text-xl font-semibold">Responses</h2>
        <div className="w-72">
          <Select
            value={selectedSurveyId ?? ""}
            onValueChange={onSelectSurvey}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a survey…" />
            </SelectTrigger>
            <SelectContent>
              {surveys.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} (Q{s.quarter} {s.year})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedSurveyId ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Select a survey to view its responses.
        </p>
      ) : isLoading ? (
        <p className="py-4 text-sm text-muted-foreground">
          Loading responses…
        </p>
      ) : !data || data.responses.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No responses yet for this survey.
        </p>
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client ID</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Feedback</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Responded</TableHead>
                <TableHead>Follow-Up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.responses.map((r) => (
                <TableRow key={r.id}>
                  <TableCell
                    className="font-mono text-xs text-muted-foreground"
                    title={r.client_profile_id}
                  >
                    {truncateId(r.client_profile_id)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-lg font-bold ${
                        r.score >= 9
                          ? "text-green-600 dark:text-green-400"
                          : r.score >= 7
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {r.score}
                    </span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      /10
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        isNPSScoreCategory(r.score_category)
                          ? SCORE_CATEGORY_VARIANT[r.score_category]
                          : "secondary"
                      }
                    >
                      {r.score_category}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="max-w-xs truncate text-sm"
                    title={r.comment ?? ""}
                  >
                    {r.comment ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm capitalize text-muted-foreground">
                    {r.response_channel}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(r.responded_at)}
                  </TableCell>
                  <TableCell>
                    {r.follow_up_required ? (
                      <Badge
                        variant={
                          r.follow_up_completed ? "outline" : "destructive"
                        }
                      >
                        {r.follow_up_completed ? "done" : "pending"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
