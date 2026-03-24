"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { emergencyActivateProgram } from "@/lib/api/programs";

interface EmergencyActivationDialogProps {
  programId: string;
  trigger: React.ReactNode;
}

export function EmergencyActivationDialog({
  programId,
  trigger,
}: EmergencyActivationDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [accountabilityAccepted, setAccountabilityAccepted] =
    React.useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      emergencyActivateProgram(programId, { emergency_reason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs", programId] });
      queryClient.invalidateQueries({
        queryKey: ["program-approvals", programId],
      });
      setOpen(false);
      setReason("");
      setAccountabilityAccepted(false);
    },
  });

  const canSubmit =
    reason.trim().length > 0 &&
    accountabilityAccepted &&
    !mutation.isPending;

  function handleOpenChange(next: boolean) {
    if (!next) {
      setReason("");
      setAccountabilityAccepted(false);
      mutation.reset();
    }
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Emergency Activation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive">
            Emergency Activation bypasses standard approval. A formal
            retrospective must be completed within 4 hours.
          </p>

          <div className="space-y-2">
            <Label htmlFor="emergency-reason">
              Reason for emergency activation{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="emergency-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the operational circumstance requiring immediate activation…"
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="accountability"
              checked={accountabilityAccepted}
              onCheckedChange={(checked) =>
                setAccountabilityAccepted(checked === true)
              }
            />
            <Label
              htmlFor="accountability"
              className="cursor-pointer leading-snug"
            >
              I accept personal accountability for this activation and
              understand that a formal retrospective record must be completed
              within 4 hours.
            </Label>
          </div>

          {mutation.isError && (
            <p className="text-sm text-destructive">
              {(mutation.error as Error)?.message ??
                "Activation failed. Please try again."}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
          >
            {mutation.isPending
              ? "Activating…"
              : "Emergency Activate Program"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
