"use client";

import * as React from "react";
import { AlertTriangle, ExternalLink, UserCheck } from "lucide-react";
import type { DuplicateMatch } from "@/types/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateMatch[];
  /** Called when the user chooses to proceed with creating the new client anyway. */
  onCreateAnyway: () => void;
}

function scoreLabel(score: number): { label: string; variant: "destructive" | "outline" | "secondary" } {
  if (score >= 0.95) return { label: "Very likely duplicate", variant: "destructive" };
  if (score >= 0.85) return { label: "Likely duplicate", variant: "destructive" };
  if (score >= 0.75) return { label: "Possible duplicate", variant: "outline" };
  return { label: "Low similarity", variant: "secondary" };
}

export function DuplicateWarningDialog({
  open,
  onOpenChange,
  duplicates,
  onCreateAnyway,
}: DuplicateWarningDialogProps) {
  const handleCreateAnyway = () => {
    onOpenChange(false);
    onCreateAnyway();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                Potential duplicate{duplicates.length > 1 ? "s" : ""} detected
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
                {duplicates.length === 1
                  ? "An existing client profile may match the details you entered."
                  : `${duplicates.length} existing client profiles may match the details you entered.`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2 max-h-80 space-y-3 overflow-y-auto pr-1">
          {duplicates.map((match) => {
            const { label, variant } = scoreLabel(match.similarity_score);
            return (
              <div
                key={match.client_id}
                className="rounded-lg border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">
                        {match.legal_name}
                      </span>
                      {match.display_name && match.display_name !== match.legal_name && (
                        <span className="truncate text-sm text-muted-foreground">
                          ({match.display_name})
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>{match.primary_email}</span>
                      {match.phone && <span>{match.phone}</span>}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {match.match_reasons.map((reason) => (
                        <Badge key={reason} variant="secondary" className="text-xs">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge variant={variant} className="whitespace-nowrap text-xs">
                      {label}
                    </Badge>
                    <a
                      href={`/clients/${match.client_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View profile
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="mt-4 gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Go back and review
          </Button>
          <Button
            variant="destructive"
            onClick={handleCreateAnyway}
          >
            Create new client anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
