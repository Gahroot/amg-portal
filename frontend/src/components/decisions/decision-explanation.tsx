"use client";

import { AlertCircle, CheckCircle2, ChevronRight, Clock, Info, Lightbulb } from "lucide-react";
import type { DecisionOption, DecisionRequest } from "@/types/communication";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface DecisionExplanationProps {
  decision: DecisionRequest;
  /** Currently highlighted / hovered option id */
  highlightedOptionId?: string;
  className?: string;
}

/** Shown when an individual option has rich explanation data. */
function OptionExplanationBlock({ option }: { option: DecisionOption }) {
  const hasRichData =
    option.impact_description ||
    option.what_happens_next ||
    (option.considerations && option.considerations.length > 0);

  if (!hasRichData) return null;

  return (
    <div className="mt-3 space-y-3 rounded-lg border bg-muted/40 p-3 text-sm">
      {option.impact_description && (
        <div className="flex gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
          <div>
            <p className="font-medium text-foreground">What this means</p>
            <p className="mt-0.5 text-muted-foreground">{option.impact_description}</p>
          </div>
        </div>
      )}

      {option.what_happens_next && (
        <div className="flex gap-2">
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <div>
            <p className="font-medium text-foreground">What happens next</p>
            <p className="mt-0.5 text-muted-foreground">{option.what_happens_next}</p>
          </div>
        </div>
      )}

      {option.considerations && option.considerations.length > 0 && (
        <div className="flex gap-2">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <p className="font-medium text-foreground">Things to consider</p>
            <ul className="mt-1 space-y-1">
              {option.considerations.map((c, i) => (
                <li key={i} className="flex items-start gap-1.5 text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/** Static FAQ items relevant to any decision. */
const GENERAL_FAQS = [
  {
    q: "Can I change my mind after responding?",
    a: "Once you submit your response it is recorded and your advisory team is notified. If you need to revise it, please contact your relationship manager as soon as possible — changes may still be possible before any actions have been taken.",
  },
  {
    q: "What if none of the options feel right?",
    a: "You can reach out to your advisory team before responding. Use the messaging feature to ask questions or request a call. Your team is here to help you make the best decision for your situation.",
  },
  {
    q: "What happens if I miss the deadline?",
    a: "Your advisory team will typically follow up with you. In some cases a default action may be taken — this will be noted in the decision itself. Missing a deadline does not mean you lose the ability to influence the outcome; contact your team immediately.",
  },
  {
    q: "Is my decision private?",
    a: "Your response is shared only with your designated advisory team. It is never shared with third parties without your consent.",
  },
];

export function DecisionExplanation({
  decision,
  highlightedOptionId,
  className,
}: DecisionExplanationProps) {
  const options = decision.options ?? [];
  const recommendedOption = options.find((o) => o.recommended);
  const hasRichOptions = options.some(
    (o) => o.impact_description || o.what_happens_next || (o.considerations?.length ?? 0) > 0
  );

  return (
    <div className={cn("space-y-5", className)}>
      {/* Context banner */}
      <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/30">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium">Your advisory team needs your input</p>
          <p className="mt-0.5 opacity-90">
            Review the options below, then use the form to record your decision. There&apos;s no
            wrong answer — choose what feels right for your goals.
          </p>
        </div>
      </div>

      {/* Deadline / consequence */}
      {(decision.deadline_date || decision.consequence_text) && (
        <div className="flex gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/40 dark:bg-orange-950/30">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
          <div className="text-sm text-orange-800 dark:text-orange-300">
            {decision.deadline_date && (
              <p className="font-medium">
                Response needed by{" "}
                {new Date(decision.deadline_date).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
                {decision.deadline_time && (
                  <span>
                    {" "}
                    at{" "}
                    {new Date(`2000-01-01T${decision.deadline_time}`).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </p>
            )}
            {decision.consequence_text && (
              <p className={cn("opacity-90", decision.deadline_date && "mt-0.5")}>
                {decision.consequence_text}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Recommended option callout */}
      {recommendedOption && (
        <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="text-sm text-emerald-800 dark:text-emerald-300">
            <p className="font-medium">Advisory team recommendation</p>
            <p className="mt-0.5 opacity-90">
              Your team suggests{" "}
              <span className="font-semibold">&ldquo;{recommendedOption.label}&rdquo;</span> based
              on your current program goals. You are of course free to choose any option.
            </p>
          </div>
        </div>
      )}

      {/* Per-option explanations */}
      {hasRichOptions && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Understanding your options
          </h3>
          {options.map((option) => {
            const isHighlighted = highlightedOptionId === option.id;
            return (
              <div
                key={option.id}
                className={cn(
                  "rounded-lg border p-4 transition-colors",
                  isHighlighted
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-background",
                  option.recommended && "ring-1 ring-emerald-400/60"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{option.label}</p>
                  <div className="flex gap-1.5">
                    {option.recommended && (
                      <Badge
                        variant="outline"
                        className="border-emerald-400 text-emerald-700 dark:text-emerald-400 text-xs"
                      >
                        Recommended
                      </Badge>
                    )}
                  </div>
                </div>
                {option.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                )}
                <OptionExplanationBlock option={option} />
              </div>
            );
          })}
        </div>
      )}

      {/* FAQ accordion */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Frequently asked questions
          </h3>
        </div>
        <Accordion type="multiple" className="rounded-lg border">
          {GENERAL_FAQS.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className={cn(i === 0 && "border-t-0")}
            >
              <AccordionTrigger className="px-4 text-sm font-medium hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="px-4 text-sm text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
