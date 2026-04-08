"use client";

import { use, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Clock, Scale, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AddToCalendarButton } from "@/components/decisions/add-to-calendar-button";
import { DecisionResponseDialog } from "@/components/decisions/decision-response-dialog";
import { useDecision } from "@/hooks/use-decisions";
import { cn } from "@/lib/utils";

interface DecisionDetailPageProps {
  params: Promise<{ id: string }>;
}

const statusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "text-orange-500 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30", label: "Pending" },
  responded: { color: "text-green-600 dark:text-green-400 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30", label: "Responded" },
  declined: { color: "text-red-500 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30", label: "Declined" },
  expired: { color: "text-muted-foreground border-border bg-muted/50 dark:bg-gray-900/20", label: "Expired" },
  cancelled: { color: "text-muted-foreground border-border bg-muted/50 dark:bg-gray-900/20", label: "Cancelled" },
};

export default function DecisionDetailPage({ params }: DecisionDetailPageProps) {
  const { id } = use(params);
  const { data: decision, isLoading, error } = useDecision(id);
  const [respondOpen, setRespondOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (error || !decision) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-destructive">Decision not found or access denied.</p>
        <Button variant="ghost" size="sm" asChild className="mt-4">
          <Link href="/portal/decisions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Decisions
          </Link>
        </Button>
      </div>
    );
  }

  const config = statusConfig[decision.status] ?? statusConfig.pending;
  const hasDeadline = !!decision.deadline_date;
  const isOverdue =
    hasDeadline &&
    new Date(decision.deadline_date!) < new Date() &&
    decision.status === "pending";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back navigation */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/portal/decisions">
          <ArrowLeft className="mr-2 h-4 w-4" />
          All Decisions
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start gap-3">
        <Scale className="mt-1 h-6 w-6 shrink-0 text-muted-foreground" />
        <div>
          <h1 className="font-serif text-2xl font-bold leading-tight">{decision.title}</h1>
          <Badge variant="outline" className={cn("mt-2 text-xs", config.color)}>
            {config.label}
          </Badge>
        </div>
      </div>

      <Separator />

      {/* Decision prompt */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">What we need from you</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-foreground">{decision.prompt}</p>
        </CardContent>
      </Card>

      {/* Response options */}
      {decision.options && decision.options.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {decision.options.map((option) => (
              <div key={option.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{option.label}</p>
                {option.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Deadline section */}
      {hasDeadline && (
        <Card className={cn(isOverdue && "border-orange-500/50")}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className={cn("h-4 w-4", isOverdue ? "text-orange-500" : "text-muted-foreground")} />
              Decision Deadline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={cn("text-lg font-semibold", isOverdue && "text-orange-600 dark:text-orange-400")}>
                  {format(new Date(decision.deadline_date!), "EEEE, MMMM d, yyyy")}
                </p>
                {decision.deadline_time && (
                  <p className="text-sm text-muted-foreground">
                    by {format(new Date(`2000-01-01T${decision.deadline_time}`), "h:mm a")} UTC
                  </p>
                )}
                {isOverdue && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                    <AlertTriangle className="h-3 w-3" />
                    This deadline has passed
                  </p>
                )}
              </div>
              <AddToCalendarButton decision={decision} />
            </div>

            {decision.consequence_text && (
              <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                <span className="font-medium">If no response: </span>
                {decision.consequence_text}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Existing response */}
      {decision.response && decision.status !== "pending" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Response</CardTitle>
          </CardHeader>
          <CardContent>
            {decision.response.option_id && (
              <p className="text-sm">
                <span className="font-medium">Selected: </span>
                {decision.options?.find((o) => o.id === decision.response?.option_id)?.label ??
                  decision.response.option_id}
              </p>
            )}
            {decision.response.text && (
              <p className="text-sm">{decision.response.text}</p>
            )}
            {decision.responded_at && (
              <p className="mt-2 text-xs text-muted-foreground">
                Responded {format(new Date(decision.responded_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action */}
      {decision.status === "pending" && (
        <div className="flex justify-end">
          <Button size="lg" onClick={() => setRespondOpen(true)}>
            Submit My Response
          </Button>
        </div>
      )}

      {respondOpen && (
        <DecisionResponseDialog
          decision={decision}
          open={respondOpen}
          onOpenChange={setRespondOpen}
        />
      )}
    </div>
  );
}
