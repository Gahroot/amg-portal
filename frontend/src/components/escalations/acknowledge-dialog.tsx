"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AcknowledgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAcknowledge: () => void;
  isPending: boolean;
  escalationTitle: string;
}

export function AcknowledgeDialog({
  open,
  onOpenChange,
  onAcknowledge,
  isPending,
  escalationTitle,
}: AcknowledgeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Acknowledge Escalation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm text-muted-foreground">Escalation</p>
            <p className="font-medium">{escalationTitle}</p>
          </div>

          <p className="text-sm text-muted-foreground">
            By acknowledging this escalation, you confirm that you are aware of the issue
            and will take appropriate action. The status will change to &quot;Acknowledged&quot;.
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={onAcknowledge} disabled={isPending}>
            {isPending ? "Acknowledging..." : "Acknowledge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
