"use client";

import { useState } from "react";
import { Star, CheckCircle2, MessageSquareText, BarChart2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveNPSSurvey, useSubmitNPSResponse } from "@/hooks/use-nps-surveys";
import type { NPSResponse, NPSScoreCategory } from "@/types/nps-survey";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getScoreCategory(score: number): NPSScoreCategory {
  if (score <= 6) return "detractor";
  if (score <= 8) return "passive";
  return "promoter";
}

function getScoreButtonClass(score: number, selected: number | null): string {
  const isSelected = score === selected;
  const base =
    "h-11 w-11 rounded-full text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border-2 ";

  // Colour by NPS tier
  if (score <= 6) {
    // Detractor range — red/orange tones
    return isSelected
      ? base + "bg-red-500 border-red-500 text-white shadow-md scale-110"
      : base + "border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50/30 dark:bg-red-950/30 dark:hover:bg-red-950";
  }
  if (score <= 8) {
    // Passive range — amber tones
    return isSelected
      ? base + "bg-amber-400 border-amber-400 dark:border-amber-600 text-white shadow-md scale-110"
      : base + "border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50/30 dark:bg-amber-950/30 dark:hover:bg-amber-950";
  }
  // Promoter range — green tones
  return isSelected
    ? base + "bg-green-500 border-green-500 text-white shadow-md scale-110"
    : base + "border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50/30 dark:bg-green-950/30 dark:hover:bg-green-950";
}

interface CategoryInfo {
  label: string;
  badgeVariant: "destructive" | "secondary" | "default";
  headline: string;
  message: string;
}

function getCategoryInfo(category: NPSScoreCategory): CategoryInfo {
  switch (category) {
    case "detractor":
      return {
        label: "Feedback Received",
        badgeVariant: "destructive",
        headline: "We hear you, and we're grateful for your honesty.",
        message:
          "Your candid feedback helps us understand where we can do better. Our team will review your response and reach out if we can help resolve any concerns you may have.",
      };
    case "passive":
      return {
        label: "Thank You",
        badgeVariant: "secondary",
        headline: "Thank you for sharing your experience with us.",
        message:
          "Your feedback helps us raise the bar. We're committed to making every interaction exceptional, and we'll continue working to exceed your expectations.",
      };
    case "promoter":
      return {
        label: "Wonderful",
        badgeVariant: "default",
        headline: "It means the world to us that you'd recommend our services.",
        message:
          "Your trust and support inspire us to keep delivering the highest standard of service. Thank you for being such a valued part of the AMG family.",
      };
  }
}

function getQuarterLabel(quarter: number, year: string): string {
  return `Q${quarter} ${year}`;
}

// ─── Already Responded State ────────────────────────────────────────────────

function AlreadyRespondedView() {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h2 className="font-serif text-2xl font-bold">Already Submitted</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          You&apos;ve already shared your feedback for this survey period. Thank you — your
          response has been recorded and is being reviewed by our team.
        </p>
      </div>
    </div>
  );
}

// ─── Thank You State ─────────────────────────────────────────────────────────

function ThankYouView({ response }: { response: NPSResponse }) {
  const info = getCategoryInfo(response.score_category);

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
        <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
      </div>

      <div className="space-y-3">
        <Badge variant={info.badgeVariant} className="px-3 py-1 text-xs font-medium">
          {info.label}
        </Badge>
        <h2 className="font-serif text-2xl font-bold">{info.headline}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{info.message}</p>
      </div>

      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-5 py-3">
        <span className="text-sm text-muted-foreground">Your score</span>
        <span className="font-serif text-3xl font-bold">{response.score}</span>
        <span className="text-sm text-muted-foreground">out of 10</span>
      </div>
    </div>
  );
}

// ─── Survey Form ─────────────────────────────────────────────────────────────

interface SurveyFormProps {
  surveyId: string;
  surveyName: string;
  quarter: number;
  year: string;
  question: string;
  onSuccess: (response: NPSResponse) => void;
  onAlreadyResponded: () => void;
}

function SurveyForm({
  surveyId,
  surveyName,
  quarter,
  year,
  question,
  onSuccess,
  onAlreadyResponded,
}: SurveyFormProps) {
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  const submitMutation = useSubmitNPSResponse();

  const handleSubmit = () => {
    if (selectedScore === null) return;

    submitMutation.mutate(
      {
        surveyId,
        data: {
          survey_id: surveyId,
          score: selectedScore,
          comment: comment.trim() || undefined,
          response_channel: "portal",
        },
      },
      {
        onSuccess: (response) => {
          onSuccess(response);
        },
        onError: (error: Error) => {
          const msg = error?.message ?? "";
          if (msg.toLowerCase().includes("already responded")) {
            onAlreadyResponded();
          }
          // Toast is shown by the hook's onError handler
        },
      }
    );
  };

  return (
    <div className="space-y-8">
      {/* Survey meta */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {getQuarterLabel(quarter, year)} Survey
          </Badge>
        </div>
        <h2 className="font-serif text-xl font-semibold leading-snug">{surveyName}</h2>
        <p className="text-base text-foreground">{question}</p>
      </div>

      {/* Score selector */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 11 }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedScore(i)}
              className={getScoreButtonClass(i, selectedScore)}
              aria-label={`Score ${i}`}
              aria-pressed={selectedScore === i}
            >
              {i}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0 — Not at all likely</span>
          <span>10 — Extremely likely</span>
        </div>
      </div>

      {/* Score preview */}
      {selectedScore !== null && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            You selected{" "}
            <span className="font-semibold text-foreground">{selectedScore}</span>
          </span>
          <span>·</span>
          <span className="capitalize">{getScoreCategory(selectedScore)}</span>
        </div>
      )}

      {/* Optional comment */}
      <div className="space-y-2">
        <label
          htmlFor="nps-comment"
          className="flex items-center gap-1.5 text-sm font-medium"
        >
          <MessageSquareText className="h-4 w-4 text-muted-foreground" />
          Additional comments{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id="nps-comment"
          placeholder="Share any thoughts, highlights, or areas where we could improve…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          className="resize-none"
          maxLength={2000}
        />
        {comment.length > 0 && (
          <p className="text-right text-xs text-muted-foreground">{comment.length} / 2000</p>
        )}
      </div>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={selectedScore === null || submitMutation.isPending}
        className="w-full sm:w-auto"
        size="lg"
      >
        {submitMutation.isPending ? "Submitting…" : "Submit Feedback"}
      </Button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalSurveyPage() {
  const { data: survey, isLoading } = useActiveNPSSurvey();

  const [submittedResponse, setSubmittedResponse] = useState<NPSResponse | null>(null);
  const [alreadyResponded, setAlreadyResponded] = useState(false);

  // Derive the survey question from the questions field if available
  const surveyQuestion =
    survey?.questions &&
    typeof survey.questions === "object" &&
    "main_question" in survey.questions &&
    typeof survey.questions.main_question === "string"
      ? survey.questions.main_question
      : "How likely are you to recommend AMG's services to a colleague, friend, or family member?";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart2 className="h-7 w-7 text-muted-foreground" />
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Feedback Survey</h1>
          <p className="text-sm text-muted-foreground">
            Help us serve you better with a quick satisfaction survey
          </p>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              {Array.from({ length: 11 }, (_, i) => (
                <Skeleton key={i} className="h-11 w-11 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      )}

      {/* No active survey */}
      {!isLoading && !survey && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Star className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">No surveys at this time</p>
              <p className="text-sm text-muted-foreground">
                We conduct quarterly satisfaction surveys. Check back next quarter — your
                feedback matters to us.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active survey */}
      {!isLoading && survey && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">Quarterly Satisfaction Survey</CardTitle>
            <CardDescription>
              Your responses are confidential and will only be used to improve our services.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {submittedResponse ? (
              <ThankYouView response={submittedResponse} />
            ) : alreadyResponded ? (
              <AlreadyRespondedView />
            ) : (
              <SurveyForm
                surveyId={survey.id}
                surveyName={survey.name}
                quarter={survey.quarter}
                year={survey.year}
                question={surveyQuestion}
                onSuccess={(response) => setSubmittedResponse(response)}
                onAlreadyResponded={() => setAlreadyResponded(true)}
              />
            )}
          </CardContent>

          {!submittedResponse && !alreadyResponded && (
            <CardFooter className="border-t pt-4">
              <p className="text-xs text-muted-foreground">
                This survey closes{" "}
                {survey.closes_at
                  ? new Date(survey.closes_at).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "at the end of the quarter"}
                .
              </p>
            </CardFooter>
          )}
        </Card>
      )}

      {/* NPS Explanation */}
      {!isLoading && survey && !submittedResponse && !alreadyResponded && (
        <Alert>
          <Star className="h-4 w-4" />
          <AlertTitle>About this survey</AlertTitle>
          <AlertDescription>
            The Net Promoter Score (NPS) is a simple, globally recognised measure of client
            satisfaction. Scores of 9–10 are Promoters, 7–8 are Passives, and 0–6 are
            Detractors. Our goal is an NPS above 70.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
