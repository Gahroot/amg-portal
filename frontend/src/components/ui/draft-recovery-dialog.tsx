"use client";

import * as React from "react";
import { FileText, Trash2, RotateCcw } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DraftData } from "@/hooks/use-auto-save";

export interface DraftRecoveryDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Draft data to display */
  draft: DraftData<Record<string, unknown>> | null;
  /** Callback when user chooses to restore the draft */
  onRestore: () => void;
  /** Callback when user chooses to discard the draft */
  onDiscard: () => void;
  /** Optional title for the dialog */
  title?: string;
  /** Optional description for the dialog */
  description?: string;
  /** Custom class name */
  className?: string;
}

/**
 * Formats a timestamp to a human-readable string.
 */
function formatDraftTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return "just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  } else if (diffDays === 1) {
    return "yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

/**
 * Dialog component for recovering a previously saved draft.
 *
 * @example
 * ```tsx
 * const { hasDraft, getDraft, restoreDraft, clearDraft } = useAutoSave({ formId: 'my-form' });
 * const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
 * const [draft, setDraft] = useState(null);
 *
 * useEffect(() => {
 *   if (hasDraft()) {
 *     setDraft(getDraft());
 *     setShowRecoveryDialog(true);
 *   }
 * }, []);
 *
 * const handleRestore = () => {
 *   const data = restoreDraft();
 *   if (data) {
 *     form.reset(data);
 *   }
 *   setShowRecoveryDialog(false);
 * };
 *
 * const handleDiscard = () => {
 *   clearDraft();
 *   setShowRecoveryDialog(false);
 * };
 *
 * return (
 *   <DraftRecoveryDialog
 *     open={showRecoveryDialog}
 *     onOpenChange={setShowRecoveryDialog}
 *     draft={draft}
 *     onRestore={handleRestore}
 *     onDiscard={handleDiscard}
 *   />
 * );
 * ```
 */
export function DraftRecoveryDialog({
  open,
  onOpenChange,
  draft,
  onRestore,
  onDiscard,
  title = "Recover Draft",
  description = "You have a previously saved draft. Would you like to restore it?",
  className,
}: DraftRecoveryDialogProps) {
  const handleRestore = () => {
    onRestore();
    onOpenChange(false);
  };

  const handleDiscard = () => {
    onDiscard();
    onOpenChange(false);
  };

  const formattedTime = draft ? formatDraftTimestamp(draft.timestamp) : null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        data-slot="draft-recovery-dialog"
        className={cn("sm:max-w-md", className)}
      >
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
              <FileText className="size-5 text-primary" />
            </div>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left">
            {description}
            {formattedTime && (
              <span className="mt-2 block text-sm">
                Draft saved: <strong>{formattedTime}</strong>
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel asChild>
            <Button
              variant="outline"
              onClick={handleDiscard}
              className="w-full gap-2 sm:w-auto"
            >
              <Trash2 className="size-4" />
              Discard Draft
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={handleRestore} className="w-full gap-2 sm:w-auto">
              <RotateCcw className="size-4" />
              Restore Draft
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export interface DraftRecoveryBannerProps {
  /** Whether a draft exists */
  hasDraft: boolean;
  /** Draft timestamp */
  draftTimestamp?: number | null;
  /** Callback to restore the draft */
  onRestore: () => void;
  /** Callback to discard the draft */
  onDiscard: () => void;
  /** Custom class name */
  className?: string;
}

/**
 * Inline banner component for draft recovery (alternative to modal dialog).
 *
 * @example
 * ```tsx
 * <DraftRecoveryBanner
 *   hasDraft={hasDraft()}
 *   draftTimestamp={getDraft()?.timestamp}
 *   onRestore={handleRestore}
 *   onDiscard={handleDiscard}
 * />
 * ```
 */
export function DraftRecoveryBanner({
  hasDraft,
  draftTimestamp,
  onRestore,
  onDiscard,
  className,
}: DraftRecoveryBannerProps) {
  const [dismissed, setDismissed] = React.useState(false);

  if (!hasDraft || dismissed) {
    return null;
  }

  const formattedTime = draftTimestamp
    ? formatDraftTimestamp(draftTimestamp)
    : null;

  return (
    <div
      data-slot="draft-recovery-banner"
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20",
        className
      )}
      role="alert"
    >
      <div className="flex items-center gap-2">
        <FileText className="size-4 text-amber-600 dark:text-amber-500" />
        <span className="text-sm text-amber-800 dark:text-amber-200">
          Draft available
          {formattedTime && (
            <span className="ml-1 text-amber-600 dark:text-amber-400">
              ({formattedTime})
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismissed(true)}
          className="h-7 px-2 text-xs text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/40"
        >
          Ignore
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDiscard}
          className="h-7 px-2 text-xs text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/40"
        >
          Discard
        </Button>
        <Button
          size="sm"
          onClick={onRestore}
          className="h-7 bg-amber-600 px-3 text-xs text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
        >
          Restore
        </Button>
      </div>
    </div>
  );
}

export interface DraftClearConfirmationDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when user confirms to clear the draft */
  onConfirm: () => void;
  /** Custom class name */
  className?: string;
}

/**
 * Confirmation dialog for clearing a draft.
 *
 * @example
 * ```tsx
 * const [showClearConfirm, setShowClearConfirm] = useState(false);
 *
 * const handleClearDraft = () => {
 *   clearDraft();
 *   setShowClearConfirm(false);
 * };
 *
 * return (
 *   <>
 *     <Button onClick={() => setShowClearConfirm(true)}>Clear Draft</Button>
 *     <DraftClearConfirmationDialog
 *       open={showClearConfirm}
 *       onOpenChange={setShowClearConfirm}
 *       onConfirm={handleClearDraft}
 *     />
 *   </>
 * );
 * ```
 */
export function DraftClearConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  className,
}: DraftClearConfirmationDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        data-slot="draft-clear-confirmation-dialog"
        className={cn("sm:max-w-sm", className)}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Clear Draft</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to clear this draft? This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Clear Draft
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DraftRecoveryDialog;
