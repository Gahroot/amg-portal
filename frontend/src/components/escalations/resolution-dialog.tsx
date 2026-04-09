"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve: (notes: string, status: "resolved" | "closed") => void;
  isPending: boolean;
  escalationTitle: string;
}

export function ResolutionDialog({
  open,
  onOpenChange,
  onResolve,
  isPending,
  escalationTitle,
}: ResolutionDialogProps) {
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"resolved" | "closed">("resolved");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onResolve(notes, status);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setNotes("");
      setStatus("resolved");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve Escalation</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm text-muted-foreground">Escalation</p>
            <p className="font-medium">{escalationTitle}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Final Status</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as "resolved" | "closed")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed (No Action Needed)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Resolution Notes *</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe the resolution and any actions taken..."
              rows={4}
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !notes.trim()}>
              {isPending ? "Resolving..." : "Resolve"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
