"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { verifyKYCDocument } from "@/lib/api/kyc-verifications";
import type { KYCVerifyRequest } from "@/types/kyc-verification";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface VerifyActionDialogProps {
  clientId: string;
  kycId: string;
  action: "verified" | "rejected";
  trigger: React.ReactNode;
}

export function VerifyActionDialog({
  clientId,
  kycId,
  action,
  trigger,
}: VerifyActionDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [rejectionReason, setRejectionReason] = React.useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: KYCVerifyRequest) =>
      verifyKYCDocument(clientId, kycId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kyc-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["kyc-verification", kycId] });
      setOpen(false);
      setNotes("");
      setRejectionReason("");
    },
  });

  const handleSubmit = () => {
    const data: KYCVerifyRequest = {
      status: action,
      notes: notes || undefined,
      rejection_reason: action === "rejected" ? rejectionReason || undefined : undefined,
    };
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action === "verified" ? "Verify Document" : "Reject Document"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {action === "rejected" && (
            <div className="space-y-2">
              <Label htmlFor="rejection_reason">Rejection Reason</Label>
              <Textarea
                id="rejection_reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this document is being rejected..."
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={mutation.isPending || (action === "rejected" && !rejectionReason)}
            variant={action === "rejected" ? "destructive" : "default"}
          >
            {mutation.isPending
              ? "Processing..."
              : action === "verified"
                ? "Verify"
                : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
