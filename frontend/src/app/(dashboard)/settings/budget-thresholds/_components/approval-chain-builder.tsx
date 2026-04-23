"use client";

import { useState } from "react";
import { useApprovalChain, useRemoveChainStep } from "@/hooks/use-budget-approvals";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, GripVertical, Plus, X } from "lucide-react";
import { AddStepDialog, APPROVER_ROLES } from "./approval-chain-dialog";

function formatRole(role: string): string {
  return (
    APPROVER_ROLES.find((r) => r.value === role)?.label ??
    role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// ===================================================================
// Chain Detail View (steps management)
// ===================================================================

interface ChainDetailProps {
  chainId: string;
  onBack: () => void;
}

export function ChainDetail({ chainId, onBack }: ChainDetailProps) {
  const { data: chain, isLoading } = useApprovalChain(chainId);
  const removeStep = useRemoveChainStep();
  const [addStepOpen, setAddStepOpen] = useState(false);
  const [deleteStepId, setDeleteStepId] = useState<string | null>(null);

  if (isLoading || !chain) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Loading chain details…
      </p>
    );
  }

  const sortedSteps = [...chain.steps].sort(
    (a, b) => a.step_number - b.step_number
  );
  const nextStepNumber =
    sortedSteps.length > 0
      ? sortedSteps[sortedSteps.length - 1].step_number + 1
      : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h3 className="font-semibold text-lg">{chain.name}</h3>
          {chain.description && (
            <p className="text-sm text-muted-foreground">{chain.description}</p>
          )}
        </div>
        <Badge
          variant={chain.is_active ? "default" : "secondary"}
          className="ml-auto"
        >
          {chain.is_active ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Step</TableHead>
              <TableHead>Required Role</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Timeout</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSteps.map((step) => (
              <TableRow key={step.id}>
                <TableCell>
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </TableCell>
                <TableCell className="font-medium">
                  Step {step.step_number}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{formatRole(step.required_role)}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {step.is_parallel ? "Parallel" : "Sequential"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {step.timeout_hours != null ? (
                    <>
                      {step.timeout_hours}h
                      {step.auto_approve_on_timeout && (
                        <span className="ml-1 text-xs">(auto-approve)</span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteStepId(step.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {sortedSteps.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-6 text-center text-muted-foreground"
                >
                  No steps configured. Add a step to define the approval flow.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setAddStepOpen(true)}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Step
      </Button>

      <AddStepDialog
        open={addStepOpen}
        onOpenChange={setAddStepOpen}
        chainId={chainId}
        nextStepNumber={nextStepNumber}
      />

      <AlertDialog
        open={!!deleteStepId}
        onOpenChange={(o) => !o && setDeleteStepId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Step?</AlertDialogTitle>
            <AlertDialogDescription>
              This step will be permanently removed from the approval chain. Any
              in-progress requests using this chain may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteStepId) {
                  removeStep.mutate(
                    { chainId, stepId: deleteStepId },
                    { onSuccess: () => setDeleteStepId(null) }
                  );
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
