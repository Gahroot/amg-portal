"use client";

import {
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatBytes } from "@/lib/utils";
import type { FileQueueItem, PartnerAssignment } from "./deliverable-upload-types";

interface DeliverableFileListProps {
  files: FileQueueItem[];
  assignments: PartnerAssignment[];
  disabled: boolean;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<FileQueueItem>) => void;
  onToggleExpand: (id: string) => void;
  onClearAll: () => void;
}

export function DeliverableFileList({
  files,
  assignments,
  disabled,
  onRemove,
  onUpdate,
  onToggleExpand,
  onClearAll,
}: DeliverableFileListProps) {
  // Single-pass derived counts
  let readyCount = 0;
  let invalidCount = 0;
  let unassignedCount = 0;
  let allDone = files.length > 0;
  for (const f of files) {
    if (f.status === "pending" && f.assignmentId) readyCount++;
    else if (f.status === "invalid") invalidCount++;
    else if (f.status === "pending" && !f.assignmentId) unassignedCount++;
    if (!["success", "error", "invalid"].includes(f.status)) allDone = false;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {files.length} file{files.length !== 1 ? "s" : ""} queued
          {readyCount > 0 && (
            <span className="ml-2 text-foreground">· {readyCount} ready</span>
          )}
          {invalidCount > 0 && (
            <span className="ml-2 text-destructive">· {invalidCount} invalid</span>
          )}
          {unassignedCount > 0 && (
            <span className="ml-2 text-orange-600 dark:text-orange-400">
              · {unassignedCount} unassigned
            </span>
          )}
        </p>
        {!disabled && !allDone && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-muted-foreground"
          >
            Clear all
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {files.map((item) => (
          <FileRow
            key={item.id}
            item={item}
            assignments={assignments}
            disabled={disabled}
            onRemove={() => onRemove(item.id)}
            onUpdate={(patch) => onUpdate(item.id, patch)}
            onToggleExpand={() => onToggleExpand(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── FileRow ────────────────────────────────────────────────────────────────────

interface FileRowProps {
  item: FileQueueItem;
  assignments: PartnerAssignment[];
  disabled: boolean;
  onRemove: () => void;
  onUpdate: (patch: Partial<FileQueueItem>) => void;
  onToggleExpand: () => void;
}

function FileRow({ item, assignments, disabled, onRemove, onUpdate, onToggleExpand }: FileRowProps) {
  const statusIcon = {
    pending: null,
    uploading: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
    success: <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />,
    error: <XCircle className="h-4 w-4 text-destructive" />,
    invalid: <XCircle className="h-4 w-4 text-destructive" />,
  }[item.status];

  const rowBg = {
    pending: "",
    uploading: "bg-primary/5",
    success: "bg-green-50 dark:bg-green-950/30",
    error: "bg-red-50 dark:bg-red-950/30",
    invalid: "bg-red-50 dark:bg-red-950/30",
  }[item.status];

  // error rows stay expandable so users can read the error message
  const canExpand = item.status === "pending" || item.status === "error";

  return (
    <div className={`rounded-lg border ${rowBg} transition-colors`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.file.name}</p>
          <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
        </div>

        {!item.expanded && item.status === "pending" && (
          <div className="shrink-0 w-52">
            <Select
              value={item.assignmentId}
              onValueChange={(v) => onUpdate({ assignmentId: v })}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select assignment…" />
              </SelectTrigger>
              <SelectContent>
                {assignments.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    {a.title}
                    {a.program_title && (
                      <span className="ml-1 text-muted-foreground">· {a.program_title}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {item.status !== "pending" && (
          <Badge
            variant={
              item.status === "success"
                ? "default"
                : item.status === "uploading"
                  ? "secondary"
                  : "destructive"
            }
            className="shrink-0 text-xs"
          >
            {item.status === "uploading" ? "Uploading…" : item.status}
          </Badge>
        )}

        {statusIcon && <div className="shrink-0">{statusIcon}</div>}

        {canExpand && item.status !== "uploading" && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            {item.expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        )}

        {!disabled && !["uploading", "success"].includes(item.status) && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {item.expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          {item.error && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">{item.error}</AlertDescription>
            </Alert>
          )}

          {item.status === "pending" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Assignment *</Label>
                <Select
                  value={item.assignmentId}
                  onValueChange={(v) => onUpdate({ assignmentId: v })}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select an accepted assignment…" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignments.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {a.title}
                        {a.program_title && (
                          <span className="ml-1 text-muted-foreground">· {a.program_title}</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Title</Label>
                <Input
                  className="h-8 text-xs"
                  value={item.title}
                  onChange={(e) => onUpdate({ title: e.target.value })}
                  placeholder={item.file.name}
                  disabled={disabled}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea
                  className="min-h-[60px] resize-none text-xs"
                  value={item.notes}
                  onChange={(e) => onUpdate({ notes: e.target.value })}
                  placeholder="Add any notes for the coordinator…"
                  disabled={disabled}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
