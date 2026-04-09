"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { X, Plus, Mail, User } from "lucide-react";
import type {
  ReportSchedule,
  ReportScheduleCreate,
  ReportScheduleUpdate,
  ReportType,
  ReportFrequency,
  ReportFormat,
} from "@/lib/api/report-schedules";
import {
  REPORT_TYPE_LABELS,
  FREQUENCY_LABELS,
  FORMAT_LABELS,
  ENTITY_REQUIRED_TYPES,
  ENTITY_PLACEHOLDER,
} from "@/lib/api/report-schedules";

// ============================================================================
// Types
// ============================================================================

interface ScheduleReportDialogProps {
  open: boolean;
  onClose: () => void;
  /** If provided, the dialog is in edit mode */
  schedule?: ReportSchedule | null;
  onSubmit: (
    data: ReportScheduleCreate | ReportScheduleUpdate,
    id?: string,
  ) => Promise<void>;
  isPending?: boolean;
}

const ALL_REPORT_TYPES: ReportType[] = [
  "portfolio",
  "program_status",
  "completion",
  "annual_review",
  "partner_performance",
];

const ALL_FREQUENCIES: ReportFrequency[] = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
];

const ALL_FORMATS: ReportFormat[] = ["pdf", "csv"];

// Internal roles that can see partner_performance
const PARTNER_PERF_ROLES = [
  "coordinator",
  "relationship_manager",
  "managing_director",
  "finance_compliance",
];

// ============================================================================
// Component
// ============================================================================

export function ScheduleReportDialog({
  open,
  onClose,
  schedule,
  onSubmit,
  isPending = false,
}: ScheduleReportDialogProps) {
  const { user } = useAuth();
  const isEdit = !!schedule;

  const [reportType, setReportType] = useState<ReportType>(
    (schedule?.report_type as ReportType) ?? "portfolio",
  );
  const [frequency, setFrequency] = useState<ReportFrequency>(
    (schedule?.frequency as ReportFrequency) ?? "weekly",
  );
  const [format, setFormat] = useState<ReportFormat>(
    (schedule?.format as ReportFormat) ?? "pdf",
  );
  const [entityId, setEntityId] = useState<string>(
    schedule?.entity_id ?? "",
  );
  const [recipients, setRecipients] = useState<string[]>(
    schedule?.recipients ?? [],
  );
  const [recipientInput, setRecipientInput] = useState("");

  // Reset form when dialog opens/schedule changes
  useEffect(() => {
    if (open) {
      setReportType((schedule?.report_type as ReportType) ?? "portfolio");
      setFrequency((schedule?.frequency as ReportFrequency) ?? "weekly");
      setFormat((schedule?.format as ReportFormat) ?? "pdf");
      setEntityId(schedule?.entity_id ?? "");
      setRecipients(schedule?.recipients ?? []);
      setRecipientInput("");
    }
  }, [open, schedule]);

  const availableReportTypes = useMemo(() => {
    const canSeePartnerPerf = user && PARTNER_PERF_ROLES.includes(user.role);
    return ALL_REPORT_TYPES.filter(
      (t) => t !== "partner_performance" || canSeePartnerPerf,
    );
  }, [user]);

  const entityRequired = ENTITY_REQUIRED_TYPES.includes(reportType);
  const entityPlaceholder = ENTITY_PLACEHOLDER[reportType];

  // Pre-fill current user's email if no recipients yet
  function handleAddSelf() {
    if (user?.email && !recipients.includes(user.email)) {
      setRecipients((prev) => [...prev, user.email!]);
    }
  }

  function handleAddRecipient() {
    const email = recipientInput.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (recipients.includes(email)) {
      toast.error("This email is already added");
      return;
    }
    setRecipients((prev) => [...prev, email]);
    setRecipientInput("");
  }

  function handleRemoveRecipient(email: string) {
    setRecipients((prev) => prev.filter((r) => r !== email));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (recipients.length === 0) {
      toast.error("Add at least one recipient");
      return;
    }

    if (entityRequired && !entityId.trim()) {
      toast.error(`${ENTITY_PLACEHOLDER[reportType]} is required for this report type`);
      return;
    }

    if (isEdit && schedule) {
      const update: ReportScheduleUpdate = {
        frequency,
        recipients,
        format,
      };
      await onSubmit(update, schedule.id);
    } else {
      const create: ReportScheduleCreate = {
        report_type: reportType,
        entity_id: entityId.trim() || null,
        frequency,
        recipients,
        format,
      };
      await onSubmit(create);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Report Schedule" : "Schedule a Report"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the frequency, format, or recipients for this scheduled report."
              : "Configure automated report delivery to your inbox on a recurring schedule."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Report type — only shown when creating */}
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="report-type">Report Type</Label>
              <Select
                value={reportType}
                onValueChange={(v) => setReportType(v as ReportType)}
              >
                <SelectTrigger id="report-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableReportTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {REPORT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Entity ID — shown when creating if relevant */}
          {!isEdit && entityPlaceholder && (
            <div className="space-y-2">
              <Label htmlFor="entity-id">
                {ENTITY_PLACEHOLDER[reportType]}
                {!entityRequired && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    (optional)
                  </span>
                )}
              </Label>
              <Input
                id="entity-id"
                placeholder={`Enter ${entityPlaceholder.toLowerCase()}`}
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                required={entityRequired}
              />
            </div>
          )}

          <Separator />

          {/* Frequency + Format row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select
                value={frequency}
                onValueChange={(v) => setFrequency(v as ReportFrequency)}
              >
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {FREQUENCY_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="format">Format</Label>
              <Select
                value={format}
                onValueChange={(v) => setFormat(v as ReportFormat)}
              >
                <SelectTrigger id="format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {FORMAT_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Recipients */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Recipients</Label>
              {user?.email && !recipients.includes(user.email) && (
                <button
                  type="button"
                  onClick={handleAddSelf}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <User className="h-3 w-3" />
                  Add myself
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="recipient@example.com"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddRecipient();
                    }
                  }}
                  className="pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddRecipient}
                disabled={!recipientInput.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {recipients.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {recipients.map((email) => (
                  <Badge
                    key={email}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(email)}
                      className="ml-1 rounded-sm hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No recipients added yet. Reports will only be saved, not emailed.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save Changes"
                  : "Create Schedule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
