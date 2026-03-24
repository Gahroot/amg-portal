"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle } from "lucide-react";

interface ApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  action: "approve" | "reject";
  onConfirm: (reason?: string) => Promise<void>;
}

export function ApprovalDialog({
  open,
  onOpenChange,
  templateName,
  action,
  onConfirm,
}: ApprovalDialogProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(action === "reject" ? reason : undefined);
      onOpenChange(false);
      setReason("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === "approve" ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            {action === "approve" ? "Approve Template" : "Reject Template"}
          </DialogTitle>
          <DialogDescription>
            {action === "approve"
              ? `Approve "${templateName}" for use in communications.`
              : `Reject "${templateName}" and return it for revision.`}
          </DialogDescription>
        </DialogHeader>

        {action === "reject" && (
          <div className="space-y-2">
            <Label htmlFor="reason">Rejection Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="Explain why this template is being rejected..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            variant={action === "approve" ? "default" : "destructive"}
          >
            {loading
              ? action === "approve"
                ? "Approving..."
                : "Rejecting..."
              : action === "approve"
                ? "Approve"
                : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
