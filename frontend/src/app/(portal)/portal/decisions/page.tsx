"use client";

import { useState } from "react";
import Link from "next/link";
import { Scale, CheckCircle, Clock, Archive } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DecisionRequestCard } from "@/components/decisions/decision-request-card";
import { DecisionResponseDialog } from "@/components/decisions/decision-response-dialog";
import { useDecisions, usePendingDecisions } from "@/hooks/use-decisions";
import type { DecisionRequest } from "@/types/communication";

export default function PortalDecisionsPage() {
  const [selectedDecision, setSelectedDecision] = useState<DecisionRequest | null>(null);

  const { data: pendingData, isLoading: pendingLoading } = usePendingDecisions();
  const { data: allData, isLoading: allLoading } = useDecisions();

  const pendingDecisions = pendingData?.decisions ?? [];

  // Decisions that have already been resolved (not pending)
  const resolvedDecisions = (allData?.decisions ?? []).filter(
    (d) => d.status !== "pending"
  );

  const isLoading = pendingLoading || allLoading;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Scale className="h-7 w-7 text-muted-foreground" />
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight">Decisions</h1>
            <p className="text-sm text-muted-foreground">
              Review and respond to decision requests from your advisory team
            </p>
          </div>
        </div>
        <Link href="/portal/decisions/history">
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
            <Archive className="h-4 w-4" />
            View History
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading decisions…</p>
      ) : (
        <>
          {/* Pending section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <h2 className="text-lg font-semibold">
                Awaiting Your Response
                {pendingDecisions.length > 0 && (
                  <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-sm font-medium text-orange-700 dark:text-orange-300 dark:bg-orange-900/30">
                    {pendingDecisions.length}
                  </span>
                )}
              </h2>
            </div>

            {pendingDecisions.length > 0 ? (
              <>
                <Alert className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30">
                  <Scale className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <AlertTitle className="text-orange-800 dark:text-orange-300">
                    Action Required
                  </AlertTitle>
                  <AlertDescription className="text-orange-700 dark:text-orange-300">
                    You have {pendingDecisions.length} pending decision
                    {pendingDecisions.length !== 1 ? "s" : ""} that require your response. Please
                    review and respond promptly to avoid delays to your program.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 sm:grid-cols-2">
                  {pendingDecisions.map((decision) => (
                    <DecisionRequestCard
                      key={decision.id}
                      decision={decision}
                      onResponse={() => setSelectedDecision(decision)}
                      onViewDetails={() => setSelectedDecision(decision)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">
                  No pending decisions — you&apos;re all caught up.
                </p>
              </div>
            )}
          </section>

          {/* Resolved section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-muted-foreground">
                Previous Decisions
              </h2>
            </div>

            {resolvedDecisions.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 opacity-80">
                {resolvedDecisions.map((decision) => (
                  <DecisionRequestCard
                    key={decision.id}
                    decision={decision}
                    onViewDetails={() => setSelectedDecision(decision)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">No previous decisions yet.</p>
              </div>
            )}
          </section>
        </>
      )}

      {/* Response dialog */}
      {selectedDecision && (
        <DecisionResponseDialog
          decision={selectedDecision}
          open={!!selectedDecision}
          onOpenChange={(open) => {
            if (!open) setSelectedDecision(null);
          }}
        />
      )}
    </div>
  );
}
