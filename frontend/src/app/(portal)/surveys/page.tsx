"use client";

import * as React from "react";
import {
  useActiveNPSSurvey,
  useSubmitNPSResponse,
} from "@/hooks/use-nps-surveys";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SCORE_LABELS: Record<number, string> = {
  0: "Not at all likely",
  5: "Neutral",
  10: "Extremely likely",
};

export default function PortalSurveysPage() {
  const { data: survey, isLoading } = useActiveNPSSurvey();
  const [selectedScore, setSelectedScore] = React.useState<number | null>(null);
  const [comment, setComment] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  const surveyId = survey?.id ?? "";
  const submitMutation = useSubmitNPSResponse(surveyId);

  const handleSubmit = () => {
    if (selectedScore === null) {
      toast.error("Please select a score");
      return;
    }
    if (!survey) return;

    submitMutation.mutate(
      {
        survey_id: survey.id,
        score: selectedScore,
        comment: comment.trim() || undefined,
        response_channel: "portal",
      },
      {
        onSuccess: () => {
          toast.success("Thank you for your feedback!");
          setSubmitted(true);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Surveys
        </h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No active survey at this time. Check back later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Surveys
        </h1>
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <p className="text-2xl font-semibold">Thank you!</p>
            <p className="text-muted-foreground">
              Your feedback has been recorded and helps us improve our service.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-serif text-3xl font-bold tracking-tight">
        Surveys
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-xl">{survey.name}</CardTitle>
          {survey.description && (
            <CardDescription>{survey.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <Label className="text-base font-medium">
              How likely are you to recommend AMG to a friend or colleague?
            </Label>
            <div className="flex flex-wrap justify-center gap-2">
              {Array.from({ length: 11 }, (_, i) => i).map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setSelectedScore(score)}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-lg border-2 text-sm font-semibold transition-all hover:border-primary",
                    selectedScore === score
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted bg-background text-foreground"
                  )}
                >
                  {score}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>{SCORE_LABELS[0]}</span>
              <span>{SCORE_LABELS[5]}</span>
              <span>{SCORE_LABELS[10]}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">
              Any additional comments? (optional)
            </Label>
            <Textarea
              id="comment"
              placeholder="Tell us more about your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={selectedScore === null || submitMutation.isPending}
          >
            {submitMutation.isPending ? "Submitting..." : "Submit Feedback"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
