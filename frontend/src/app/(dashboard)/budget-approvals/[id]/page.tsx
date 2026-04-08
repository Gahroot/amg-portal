"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import {
  useBudgetApprovalRequest,
  useDecideBudgetApprovalStep,
  useCancelBudgetApprovalRequest,
} from "@/hooks/use-budget-approvals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type {
  BudgetApprovalStatus,
  BudgetApprovalStepStatus,
  BudgetApprovalStepResponse,
  BudgetRequestType,
} from "@/types/budget-approval";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatRequestType(type: BudgetRequestType): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStatus(status: BudgetApprovalStatus | BudgetApprovalStepStatus): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getStatusVariant(
  status: BudgetApprovalStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "approved":
      return "default";
    case "rejected":
    case "cancelled":
    case "expired":
      return "destructive";
    case "in_review":
      return "secondary";
    default:
      return "outline";
  }
}

function StepStatusIcon({
  status,
}: {
  status: BudgetApprovalStepStatus;
}) {
  switch (status) {
    case "approved":
      return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />;
    case "rejected":
      return <XCircle className="h-5 w-5 text-destructive" />;
    case "skipped":
    case "timeout":
      return <MinusCircle className="h-5 w-5 text-muted-foreground" />;
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" />;
  }
}

function ApprovalChainStep({
  step,
  isCurrentStep,
  isCurrent,
  currentUserId,
  onDecide,
  isPending,
}: {
  step: BudgetApprovalStepResponse;
  isCurrentStep: boolean;
  isCurrent: boolean;
  currentUserId: string;
  onDecide: (stepId: string, decision: "approved" | "rejected", comments: string) => void;
  isPending: boolean;
}) {
  const [comments, setComments] = React.useState("");
  const [showForm, setShowForm] = React.useState(false);

  const canAct =
    isCurrentStep &&
    (step.status === "pending" || step.status === "in_review") &&
    (step.assigned_user_id === currentUserId || step.assigned_user_id === null);

  const handleDecide = (decision: "approved" | "rejected") => {
    onDecide(step.id, decision, comments);
    setShowForm(false);
    setComments("");
  };

  return (
    <div
      className={`relative flex gap-4 pb-6 last:pb-0 ${
        isCurrent ? "before:absolute before:left-[9px] before:top-6 before:h-full before:w-px before:bg-border last:before:hidden" : ""
      }`}
    >
      <div className="mt-0.5 shrink-0">
        <StepStatusIcon status={step.status} />
      </div>

      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            Step {step.step_number}
            {step.assigned_user_name
              ? ` — ${step.assigned_user_name}`
              : ` — ${step.assigned_role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`}
          </p>
          <Badge
            variant={
              step.status === "approved"
                ? "default"
                : step.status === "rejected"
                ? "destructive"
                : "outline"
            }
            className="text-xs"
          >
            {formatStatus(step.status)}
          </Badge>
        </div>

        {step.comments && (
          <p className="text-sm text-muted-foreground italic">
            &ldquo;{step.comments}&rdquo;
          </p>
        )}

        {step.decider_name && step.decided_at && (
          <p className="text-xs text-muted-foreground">
            {step.decision === "approved" ? "Approved" : "Rejected"} by{" "}
            {step.decider_name} on{" "}
            {new Date(step.decided_at).toLocaleString()}
          </p>
        )}

        {canAct && (
          <div className="mt-3">
            {!showForm ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowForm(true)}
              >
                Act on this step
              </Button>
            ) : (
              <div className="space-y-3 rounded-md border bg-muted/30 p-4">
                <div className="space-y-2">
                  <Label htmlFor={`comments-${step.id}`}>
                    Notes (optional)
                  </Label>
                  <Textarea
                    id={`comments-${step.id}`}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Add any notes or reasoning…"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleDecide("approved")}
                    disabled={isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDecide("rejected")}
                    disabled={isPending}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowForm(false);
                      setComments("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BudgetApprovalDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user } = useAuth();

  const { data: request, isLoading } = useBudgetApprovalRequest(id);
  const decideMutation = useDecideBudgetApprovalStep();
  const cancelMutation = useCancelBudgetApprovalRequest();

  const handleDecide = (
    stepId: string,
    decision: "approved" | "rejected",
    comments: string
  ) => {
    decideMutation.mutate(
      { stepId, data: { decision, comments: comments || undefined } },
      {
        onSuccess: () => {
          toast.success(
            decision === "approved"
              ? "Step approved successfully"
              : "Step rejected"
          );
        },
      }
    );
  };

  const handleCancel = () => {
    cancelMutation.mutate(
      { id },
      {
        onSuccess: () => {
          router.push("/budget-approvals");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-muted-foreground">Request not found.</p>
        </div>
      </div>
    );
  }

  const isActive =
    request.status === "pending" || request.status === "in_review";
  const canCancel =
    isActive && user?.id === request.requested_by;

  // Steps grouped by step_number (for parallel display)
  const stepsByNumber = request.steps.reduce<
    Record<number, BudgetApprovalStepResponse[]>
  >((acc, step) => {
    const key = step.step_number;
    if (!acc[key]) acc[key] = [];
    acc[key].push(step);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 text-muted-foreground"
              onClick={() => router.push("/budget-approvals")}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Budget Approvals
            </Button>
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              {request.title}
            </h1>
            <div className="flex items-center gap-2">
              <Badge variant={getStatusVariant(request.status)}>
                {formatStatus(request.status)}
              </Badge>
              <Badge variant="secondary">
                {formatRequestType(request.request_type)}
              </Badge>
            </div>
          </div>

          {canCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0">
                  Cancel Request
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will cancel the budget approval request. This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Cancel Request
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Request Details */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">
              Request Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Program
                </p>
                <p className="text-sm">{request.program_title}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Requested By
                </p>
                <p className="text-sm">{request.requester_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Threshold
                </p>
                <p className="text-sm">{request.threshold_name || "—"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Approval Chain
                </p>
                <p className="text-sm">{request.approval_chain_name || "—"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Submitted
                </p>
                <p className="text-sm">
                  {new Date(request.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Current Step
                </p>
                <p className="text-sm">
                  {request.total_steps > 0
                    ? `${request.current_step} of ${request.total_steps}`
                    : "—"}
                </p>
              </div>
              {request.description && (
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Description
                  </p>
                  <p className="text-sm">{request.description}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Budget Impact */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">Budget Impact</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Current Budget
                </p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrency(request.current_budget)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Requested Amount
                </p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrency(request.requested_amount)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Budget Impact
                </p>
                <p
                  className={`text-lg font-semibold tabular-nums ${
                    request.budget_impact > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {request.budget_impact > 0 ? "+" : ""}
                  {formatCurrency(request.budget_impact)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Projected Budget
                </p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrency(request.projected_budget)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Approval Chain */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">
              Approval Chain
            </CardTitle>
          </CardHeader>
          <CardContent>
            {request.steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No approval steps defined.
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(stepsByNumber)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([stepNum, steps]) => (
                    <div key={stepNum}>
                      {steps.map((step) => (
                        <ApprovalChainStep
                          key={step.id}
                          step={step}
                          isCurrentStep={
                            step.step_number === request.current_step
                          }
                          isCurrent={
                            Object.keys(stepsByNumber).indexOf(stepNum) <
                            Object.keys(stepsByNumber).length - 1
                          }
                          currentUserId={user?.id ?? ""}
                          onDecide={handleDecide}
                          isPending={decideMutation.isPending}
                        />
                      ))}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Final Decision */}
        {(request.status === "approved" || request.status === "rejected") && (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl">
                Final Decision
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Outcome
                  </p>
                  <Badge variant={getStatusVariant(request.status)}>
                    {formatStatus(request.status)}
                  </Badge>
                </div>
                {request.approver_name && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Final Approver
                    </p>
                    <p className="text-sm">{request.approver_name}</p>
                  </div>
                )}
                {request.final_decision_at && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Decided At
                    </p>
                    <p className="text-sm">
                      {new Date(request.final_decision_at).toLocaleString()}
                    </p>
                  </div>
                )}
                {request.final_comments && (
                  <div className="md:col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Comments
                    </p>
                    <p className="text-sm">{request.final_comments}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* History */}
        {request.history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl">
                Activity History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {request.history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex gap-3 border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/50 mt-1.5" />
                    <div className="space-y-0.5">
                      <p className="text-sm">
                        <span className="font-medium">{entry.actor_name}</span>{" "}
                        <span className="text-muted-foreground">
                          {entry.action.replace(/_/g, " ")}
                        </span>
                        {entry.step_number != null && (
                          <span className="text-muted-foreground">
                            {" "}
                            (step {entry.step_number})
                          </span>
                        )}
                      </p>
                      {entry.comments && (
                        <p className="text-sm text-muted-foreground italic">
                          &ldquo;{entry.comments}&rdquo;
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
