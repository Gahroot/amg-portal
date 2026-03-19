"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createGovernanceAction } from "@/lib/api/partner-governance";
import type { GovernanceActionType } from "@/types/partner-governance";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface GovernanceActionFormProps {
  partnerId: string;
  partnerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACTION_OPTIONS: { value: GovernanceActionType; label: string }[] = [
  { value: "warning", label: "Warning" },
  { value: "probation", label: "Probation" },
  { value: "suspension", label: "Suspension" },
  { value: "termination", label: "Termination" },
  { value: "reinstatement", label: "Reinstatement" },
];

export function GovernanceActionForm({
  partnerId,
  partnerName,
  open,
  onOpenChange,
}: GovernanceActionFormProps) {
  const queryClient = useQueryClient();
  const [action, setAction] = React.useState<GovernanceActionType>("warning");
  const [reason, setReason] = React.useState("");
  const [expiryDate, setExpiryDate] = React.useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createGovernanceAction(partnerId, {
        action,
        reason,
        expiry_date: expiryDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["governance-history", partnerId],
      });
      queryClient.invalidateQueries({
        queryKey: ["composite-score", partnerId],
      });
      queryClient.invalidateQueries({
        queryKey: ["governance-dashboard"],
      });
      queryClient.invalidateQueries({
        queryKey: ["partners", partnerId],
      });
      onOpenChange(false);
      setAction("warning");
      setReason("");
      setExpiryDate("");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Governance Action — {partnerName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Action Type</Label>
            <Select
              value={action}
              onValueChange={(v) => setAction(v as GovernanceActionType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the reason for this governance action..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Expiry Date (optional)</Label>
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !reason.trim()}
            variant={
              action === "reinstatement" ? "default" : "destructive"
            }
          >
            {mutation.isPending ? "Applying..." : `Apply ${action}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
