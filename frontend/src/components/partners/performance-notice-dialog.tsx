"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  createPerformanceNotice,
  type NoticeType,
  type NoticeSeverity,
} from "@/lib/api/performance-notices";

interface ProgramOption {
  program_id: string;
  program_title: string | null;
}

interface PerformanceNoticeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: string;
  partnerName: string;
  programs: ProgramOption[];
}

const NOTICE_TYPE_LABELS: Record<NoticeType, string> = {
  sla_breach: "SLA Breach",
  quality_issue: "Quality Issue",
  general_performance: "General Performance",
};

const SEVERITY_LABELS: Record<NoticeSeverity, string> = {
  warning: "Warning",
  formal_notice: "Formal Notice",
  final_notice: "Final Notice",
};

const SEVERITY_DESCRIPTIONS: Record<NoticeSeverity, string> = {
  warning: "An informal alert — not yet a formal record.",
  formal_notice: "A formal record that will be permanently associated with this partner.",
  final_notice: "A final formal notice — further breaches may result in suspension.",
};

export function PerformanceNoticeDialog({
  open,
  onOpenChange,
  partnerId,
  partnerName,
  programs,
}: PerformanceNoticeDialogProps) {
  const queryClient = useQueryClient();

  const [noticeType, setNoticeType] = useState<NoticeType>("sla_breach");
  const [severity, setSeverity] = useState<NoticeSeverity>("formal_notice");
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requiredAction, setRequiredAction] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createPerformanceNotice,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["performance-notices", partnerId],
      });
      toast.success("Performance notice issued successfully.");
      handleClose();
    },
    onError: () => {
      setFormError("Failed to issue the performance notice. Please try again.");
    },
  });

  function handleClose() {
    if (mutation.isPending) return;
    setNoticeType("sla_breach");
    setSeverity("formal_notice");
    setSelectedProgramId("");
    setTitle("");
    setDescription("");
    setRequiredAction("");
    setConfirmed(false);
    setFormError(null);
    onOpenChange(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError("Notice title is required.");
      return;
    }
    if (!description.trim()) {
      setFormError("Description is required.");
      return;
    }
    if (!confirmed) {
      setFormError("You must confirm this is a formal notice before submitting.");
      return;
    }

    mutation.mutate({
      partner_id: partnerId,
      program_id: selectedProgramId || null,
      notice_type: noticeType,
      severity,
      title: title.trim(),
      description: description.trim(),
      required_action: requiredAction.trim() || null,
    });
  }

  const uniquePrograms = useMemo(() => {
    const seen = new Set<string>();
    return programs.filter((p) => {
      if (seen.has(p.program_id)) return false;
      seen.add(p.program_id);
      return true;
    });
  }, [programs]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">Issue Performance Notice</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Partner context */}
          <div className="rounded-md bg-muted px-3 py-2">
            <p className="text-xs text-muted-foreground">Partner</p>
            <p className="font-medium text-sm">{partnerName}</p>
          </div>

          {/* Notice type */}
          <div className="space-y-2">
            <Label htmlFor="notice-type">Notice Type *</Label>
            <Select
              value={noticeType}
              onValueChange={(v) => setNoticeType(v as NoticeType)}
            >
              <SelectTrigger id="notice-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(NOTICE_TYPE_LABELS) as NoticeType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {NOTICE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <Label htmlFor="severity">Severity *</Label>
            <Select
              value={severity}
              onValueChange={(v) => setSeverity(v as NoticeSeverity)}
            >
              <SelectTrigger id="severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SEVERITY_LABELS) as NoticeSeverity[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SEVERITY_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {SEVERITY_DESCRIPTIONS[severity]}
            </p>
          </div>

          {/* Program context */}
          {uniquePrograms.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="program">Program Context (optional)</Label>
              <Select
                value={selectedProgramId}
                onValueChange={setSelectedProgramId}
              >
                <SelectTrigger id="program">
                  <SelectValue placeholder="Select a program (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— No program —</SelectItem>
                  {uniquePrograms.map((p) => (
                    <SelectItem key={p.program_id} value={p.program_id}>
                      {p.program_title ?? p.program_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="notice-title">Notice Title *</Label>
            <Input
              id="notice-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. SLA breach on Project Horizon deliverable"
              maxLength={500}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the breach or issue in detail — this will be permanently recorded..."
              rows={4}
              required
            />
          </div>

          {/* Required action */}
          <div className="space-y-2">
            <Label htmlFor="required-action">Required Action (optional)</Label>
            <Textarea
              id="required-action"
              value={requiredAction}
              onChange={(e) => setRequiredAction(e.target.value)}
              placeholder="Specify any remediation steps or actions the partner must take..."
              rows={2}
            />
          </div>

          {/* Confirmation checkbox */}
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-destructive"
              />
              <span className="text-sm text-muted-foreground leading-snug">
                I confirm this is a formal notice that will be{" "}
                <strong className="text-foreground">recorded permanently</strong>{" "}
                against this partner&apos;s profile and may affect their performance rating.
              </span>
            </label>
          </div>

          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={mutation.isPending || !confirmed}
            >
              {mutation.isPending ? "Issuing Notice..." : "Issue Notice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
