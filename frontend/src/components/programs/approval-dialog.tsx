"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { decideApproval } from "@/lib/api/approvals";

interface ApprovalDialogProps {
  approvalId: string;
  programId: string;
  action: "approved" | "rejected";
  trigger: React.ReactNode;
}

export function ApprovalDialog({
  approvalId,
  programId,
  action,
  trigger,
}: ApprovalDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      decideApproval(approvalId, {
        status: action,
        comments: note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs", programId] });
      queryClient.invalidateQueries({
        queryKey: ["program-approvals", programId],
      });
      setOpen(false);
      setNote("");
    },
  });

  const label = action === "approved" ? "Approve" : "Reject";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label} Program</DialogTitle>
          <DialogDescription>
            Are you sure you want to {label.toLowerCase()} this program?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="decision-note">Note (optional)</Label>
          <Textarea
            id="decision-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={`Add a note for your ${label.toLowerCase()} decision...`}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant={action === "rejected" ? "destructive" : "default"}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? `${label}ing...` : label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
