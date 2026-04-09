"use client";

import { useMemo, useReducer, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  Clock,
  SkipForward,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Target,
  AlertTriangle,
  User,
  BookOpen,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import {
  updatePlaybookStep,
  type PlaybookWithExecution,
  type PlaybookStep,
  type StepState,
  type SuggestedAction,
} from "@/lib/api/escalation-playbooks";

interface PlaybookViewerProps {
  escalationId: string;
  data: PlaybookWithExecution;
}

interface StepRowProps {
  step: PlaybookStep;
  state: StepState | undefined;
  escalationId: string;
  onUpdate: () => void;
}

function StepRow({ step, state, escalationId, onUpdate }: StepRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(state?.notes ?? "");
  const [skipReason, setSkipReason] = useState(state?.skip_reason ?? "");
  const [showSkip, setShowSkip] = useState(false);

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (update: Parameters<typeof updatePlaybookStep>[1]) =>
      updatePlaybookStep(escalationId, update),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["escalation-playbook", escalationId],
      });
      onUpdate();
    },
    onError: () => toast.error("Failed to update step"),
  });

  const isCompleted = state?.completed ?? false;
  const isSkipped = state?.skipped ?? false;
  const isDone = isCompleted || isSkipped;

  const handleToggleComplete = () => {
    mutation.mutate({
      step_order: step.order,
      completed: !isCompleted,
      notes: notes || undefined,
    });
  };

  const handleSkip = () => {
    if (!skipReason.trim()) {
      toast.error("Please provide a reason for skipping this step");
      return;
    }
    mutation.mutate({
      step_order: step.order,
      skipped: true,
      skip_reason: skipReason,
    });
    setShowSkip(false);
  };

  const handleSaveNotes = () => {
    mutation.mutate({
      step_order: step.order,
      notes: notes || undefined,
    });
    toast.success("Notes saved");
  };

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isCompleted
          ? "border-green-200 dark:border-green-800 bg-green-50/50"
          : isSkipped
            ? "border-amber-200 dark:border-amber-800 bg-amber-50/50"
            : "border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Step number / completion indicator */}
        <div className="mt-0.5 flex-shrink-0">
          {isCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : isSkipped ? (
            <SkipForward className="h-5 w-5 text-amber-500" />
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted-foreground text-xs font-bold text-muted-foreground">
              {step.order}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`font-medium text-sm ${
                isCompleted ? "text-green-800 dark:text-green-300 line-through" : isSkipped ? "text-amber-700 dark:text-amber-300 line-through" : ""
              }`}
            >
              {step.title}
            </span>

            <div className="flex items-center gap-2">
              {step.time_estimate_minutes && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  ~{step.time_estimate_minutes}m
                </Badge>
              )}
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {isSkipped && state?.skip_reason && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Skipped: {state.skip_reason}
            </p>
          )}
          {isCompleted && state?.completed_by && (
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">
              Completed by {state.completed_by}
            </p>
          )}

          {expanded && (
            <div className="mt-3 space-y-4">
              <p className="text-sm text-muted-foreground">{step.description}</p>

              {step.resources.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Resources
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {step.resources.map((r, i) => (
                      <a
                        key={i}
                        href={r.url ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 dark:bg-blue-950/30"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {r.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {!isDone && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Notes (optional)
                  </Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes for this step…"
                    rows={2}
                    className="text-sm"
                  />
                  {notes !== (state?.notes ?? "") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSaveNotes}
                      disabled={mutation.isPending}
                    >
                      Save Notes
                    </Button>
                  )}
                </div>
              )}

              {/* Skip form */}
              {!isDone && showSkip && (
                <div className="space-y-2 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
                  <Label className="text-xs text-amber-700 dark:text-amber-300">
                    Reason for skipping (required)
                  </Label>
                  <Textarea
                    value={skipReason}
                    onChange={(e) => setSkipReason(e.target.value)}
                    placeholder="Why is this step not applicable?"
                    rows={2}
                    className="border-amber-200 dark:border-amber-800 bg-card text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 dark:bg-amber-900/30"
                      onClick={handleSkip}
                      disabled={mutation.isPending || !skipReason.trim()}
                    >
                      Confirm Skip
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowSkip(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Actions */}
              {!isDone && (
                <div className="flex gap-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`step-${step.order}`}
                      checked={isCompleted}
                      onCheckedChange={handleToggleComplete}
                      disabled={mutation.isPending}
                    />
                    <Label
                      htmlFor={`step-${step.order}`}
                      className="cursor-pointer text-sm"
                    >
                      Mark complete
                    </Label>
                  </div>
                  {!showSkip && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-muted-foreground"
                      onClick={() => setShowSkip(true)}
                    >
                      <SkipForward className="mr-1 h-3 w-3" />
                      Skip
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SuggestedActions({ actions }: { actions: SuggestedAction[] }) {
  if (actions.length === 0) return null;

  const iconFor = (type: string) => {
    switch (type) {
      case "status":
        return <Target className="h-4 w-4 text-blue-500" />;
      case "risk":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "contact":
        return <User className="h-4 w-4 text-purple-500" />;
      case "playbook":
        return <BookOpen className="h-4 w-4 text-green-500" />;
      default:
        return <Lightbulb className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Lightbulb className="h-4 w-4" />
          Suggested Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0">{iconFor(action.type)}</div>
            <div>
              <p className="text-sm font-medium">{action.label}</p>
              <p className="text-xs text-muted-foreground">{action.description}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function PlaybookViewer({ escalationId, data }: PlaybookViewerProps) {
  const { playbook, execution, suggested_actions } = data;

  const stepMap = useMemo(() => {
    const map = new Map<number, StepState>();
    if (execution) {
      for (const s of execution.step_states as StepState[]) {
        map.set(s.step_order, s);
      }
    }
    return map;
  }, [execution]);

  const progress = execution?.progress ?? {
    completed: 0,
    skipped: 0,
    total: playbook.steps.length,
    percentage: 0,
  };

  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                {playbook.name}
              </CardTitle>
              {playbook.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {playbook.description}
                </p>
              )}
            </div>
            {execution && (
              <Badge
                variant={execution.status === "completed" ? "default" : "outline"}
                className={
                  execution.status === "completed"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                    : ""
                }
              >
                {execution.status === "completed" ? "Complete" : "In Progress"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {progress.completed} of {progress.total} steps completed
                {progress.skipped > 0 && ` (${progress.skipped} skipped)`}
              </span>
              <span className="font-medium">{progress.percentage}%</span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Suggested Actions */}
      <SuggestedActions actions={suggested_actions} />

      {/* Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Resolution Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(playbook.steps as PlaybookStep[]).map((step) => (
            <StepRow
              key={step.order}
              step={step}
              state={stepMap.get(step.order)}
              escalationId={escalationId}
              onUpdate={forceUpdate}
            />
          ))}
        </CardContent>
      </Card>

      {/* Success Criteria */}
      {playbook.success_criteria.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Target className="h-4 w-4" />
              Success Criteria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {playbook.success_criteria.map((criterion, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Circle className="mt-1 h-3 w-3 flex-shrink-0 text-muted-foreground" />
                  {criterion}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Escalation Paths */}
      {playbook.escalation_paths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Further Escalation Paths
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {playbook.escalation_paths.map((path, i) => (
              <div
                key={i}
                className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 p-3 text-sm"
              >
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  If: {path.condition}
                </p>
                <p className="mt-1 text-amber-700 dark:text-amber-300">→ {path.action}</p>
                {path.contact_role && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Contact: {path.contact_role.replace(/_/g, " ")}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
