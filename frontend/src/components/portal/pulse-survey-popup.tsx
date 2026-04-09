"use client";

import { useState } from "react";
import { MessageSquareText, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useActivePulseForMe, useSubmitPulseResponse } from "@/hooks/use-pulse-surveys";
import type { PulseSurvey, PulseSurveyResponseType } from "@/types/pulse-survey";

// ─── Response renderers ───────────────────────────────────────────────────────

interface SelectorProps {
  selected: string | null;
  onSelect: (value: string) => void;
}

function EmojiSelector({ selected, onSelect }: SelectorProps) {
  const options = [
    { value: "happy", label: "😊", text: "Happy" },
    { value: "neutral", label: "😐", text: "Neutral" },
    { value: "sad", label: "😞", text: "Sad" },
  ];
  return (
    <div className="flex justify-center gap-4">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          aria-label={opt.text}
          aria-pressed={selected === opt.value}
          className={[
            "flex flex-col items-center gap-1 rounded-xl p-3 text-3xl transition-all",
            "border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            selected === opt.value
              ? "border-primary bg-primary/10 scale-110 shadow-sm"
              : "border-transparent hover:border-muted-foreground/30 hover:scale-105",
          ].join(" ")}
        >
          {opt.label}
          <span className="text-xs font-medium text-muted-foreground">{opt.text}</span>
        </button>
      ))}
    </div>
  );
}

function StarsSelector({ selected, onSelect }: SelectorProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const selectedNum = selected ? parseInt(selected, 10) : 0;

  return (
    <div
      className="flex justify-center gap-1"
      onMouseLeave={() => setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (hovered ?? selectedNum) >= n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onSelect(String(n))}
            onMouseEnter={() => setHovered(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            aria-pressed={selectedNum === n}
            className="text-3xl transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            <span className={active ? "text-amber-400" : "text-muted-foreground/30"}>★</span>
          </button>
        );
      })}
    </div>
  );
}

function YesNoSelector({ selected, onSelect }: SelectorProps) {
  return (
    <div className="flex justify-center gap-4">
      {(["yes", "no"] as const).map((val) => (
        <Button
          key={val}
          type="button"
          variant={selected === val ? "default" : "outline"}
          size="lg"
          onClick={() => onSelect(val)}
          className="min-w-24 capitalize"
        >
          {val === "yes" ? "Yes" : "No"}
        </Button>
      ))}
    </div>
  );
}

function ThumbsSelector({ selected, onSelect }: SelectorProps) {
  return (
    <div className="flex justify-center gap-6">
      {(
        [
          { value: "up", emoji: "👍", label: "Thumbs up" },
          { value: "down", emoji: "👎", label: "Thumbs down" },
        ] as const
      ).map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          aria-label={opt.label}
          aria-pressed={selected === opt.value}
          className={[
            "flex flex-col items-center gap-1 rounded-xl p-3 text-4xl transition-all",
            "border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            selected === opt.value
              ? "border-primary bg-primary/10 scale-110 shadow-sm"
              : "border-transparent hover:border-muted-foreground/30 hover:scale-105",
          ].join(" ")}
        >
          {opt.emoji}
          <span className="text-xs font-medium text-muted-foreground capitalize">
            {opt.value}
          </span>
        </button>
      ))}
    </div>
  );
}

function ResponseSelector({
  responseType,
  selected,
  onSelect,
}: {
  responseType: PulseSurveyResponseType;
  selected: string | null;
  onSelect: (v: string) => void;
}) {
  switch (responseType) {
    case "emoji":
      return <EmojiSelector selected={selected} onSelect={onSelect} />;
    case "stars":
      return <StarsSelector selected={selected} onSelect={onSelect} />;
    case "yes_no":
      return <YesNoSelector selected={selected} onSelect={onSelect} />;
    case "thumbs":
      return <ThumbsSelector selected={selected} onSelect={onSelect} />;
  }
}

// ─── Pulse popup ─────────────────────────────────────────────────────────────

interface PulseSurveyPopupProps {
  survey: PulseSurvey;
  onDismiss: () => void;
}

function PulseSurveyPopup({ survey, onDismiss }: PulseSurveyPopupProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const submitMutation = useSubmitPulseResponse();

  const handleSubmit = () => {
    if (!selected) return;
    submitMutation.mutate(
      {
        surveyId: survey.id,
        data: {
          response_value: selected,
          comment: comment.trim() || undefined,
        },
      },
      {
        onSuccess: () => setSubmitted(true),
      }
    );
  };

  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-[340px] animate-in slide-in-from-bottom-4 fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-label="Quick feedback"
    >
      <Card className="shadow-2xl border bg-background">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="font-serif text-base leading-snug">
              {survey.title}
            </CardTitle>
            <button
              type="button"
              onClick={onDismiss}
              className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm">Thank you for your feedback!</p>
                <p className="text-xs text-muted-foreground">
                  Your response helps us improve our service.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={onDismiss} className="mt-1">
                Close
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {survey.question}
              </p>
              <ResponseSelector
                responseType={survey.response_type}
                selected={selected}
                onSelect={setSelected}
              />
              {survey.allow_comment && selected && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="pulse-comment"
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                  >
                    <MessageSquareText className="h-3.5 w-3.5" />
                    Any comments? (optional)
                  </label>
                  <Textarea
                    id="pulse-comment"
                    placeholder="Share any thoughts…"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    className="resize-none text-sm"
                    maxLength={500}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>

        {!submitted && (
          <CardFooter className="flex gap-2 border-t pt-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              className="flex-1 text-muted-foreground"
            >
              Skip
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!selected || submitMutation.isPending}
              className="flex-1"
            >
              {submitMutation.isPending ? "Sending…" : "Submit"}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

// ─── Container — renders the popup when a pending survey exists ───────────────

export function PulseSurveyContainer() {
  const { data: survey } = useActivePulseForMe();
  const [dismissed, setDismissed] = useState(false);

  if (!survey || dismissed) return null;

  return <PulseSurveyPopup survey={survey} onDismiss={() => setDismissed(true)} />;
}
