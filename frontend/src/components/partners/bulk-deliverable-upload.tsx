"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload,
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  CloudUpload,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { usePartnerAssignments } from "@/hooks/use-partner-portal";
import {
  bulkSubmitDeliverables,
  type BulkSubmitFileResult,
} from "@/lib/api/partner-portal";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
];

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

// ── Types ─────────────────────────────────────────────────────────────────────

type FileStatus = "pending" | "uploading" | "success" | "error" | "invalid";

interface FileQueueItem {
  id: string;
  file: File;
  assignmentId: string;
  title: string;
  notes: string;
  status: FileStatus;
  error: string | null;
  deliverableId: string | null;
  /** Whether the per-file detail panel is open */
  expanded: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File exceeds the ${MAX_FILE_SIZE_MB} MB size limit`;
  }
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return `File type "${file.type}" is not allowed`;
  }
  return null;
}

/**
 * Attempt to auto-match a filename to an assignment by looking for words from
 * the assignment title inside the filename (case-insensitive).
 */
function autoMatchAssignment(
  filename: string,
  assignments: { id: string; title: string; status: string }[]
): string {
  const nameLower = filename.toLowerCase().replace(/[^a-z0-9]/g, " ");
  const accepted = assignments.filter((a) => a.status === "accepted");

  let bestId = "";
  let bestScore = 0;

  for (const a of accepted) {
    const words = a.title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3);
    const score = words.filter((w) => nameLower.includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      bestId = a.id;
    }
  }

  return bestScore > 0 ? bestId : (accepted[0]?.id ?? "");
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface BulkDeliverableUploadProps {
  /** Called after successful submission so the parent can navigate away */
  onComplete?: (result: { succeeded: number; failed: number }) => void;
}

export function BulkDeliverableUpload({ onComplete }: BulkDeliverableUploadProps) {
  const queryClient = useQueryClient();
  const { data: assignmentsData } = usePartnerAssignments({ status: "accepted" });
  const acceptedAssignments = (assignmentsData?.assignments ?? []).filter(
    (a) => a.status === "accepted"
  );

  const [queue, setQueue] = React.useState<FileQueueItem[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [summary, setSummary] = React.useState<{ succeeded: number; failed: number } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // ── File queue management ─────────────────────────────────────────────────

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const newItems: FileQueueItem[] = arr.map((file) => {
      const validationError = validateFile(file);
      const matchedId = autoMatchAssignment(file.name, acceptedAssignments);
      return {
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        assignmentId: matchedId,
        title: file.name.replace(/\.[^.]+$/, ""), // strip extension as default title
        notes: "",
        status: validationError ? "invalid" : "pending",
        error: validationError,
        deliverableId: null,
        expanded: false,
      };
    });
    setQueue((prev) => [...prev, ...newItems]);
  }

  function removeItem(id: string) {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }

  function updateItem(id: string, patch: Partial<FileQueueItem>) {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function toggleExpanded(id: string) {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, expanded: !item.expanded } : item))
    );
  }

  // ── Drag and drop ─────────────────────────────────────────────────────────

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      // Reset so the same file can be re-selected
      e.target.value = "";
    }
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  async function handleUpload() {
    const uploadable = queue.filter(
      (item) => item.status === "pending" && item.assignmentId
    );

    if (uploadable.length === 0) {
      toast.error("No valid files ready to upload. Assign each file to an accepted assignment.");
      return;
    }

    setIsUploading(true);
    setSummary(null);
    setUploadProgress(0);

    let succeeded = 0;
    let failed = 0;

    // Upload sequentially — gives real per-file progress feedback
    for (let i = 0; i < uploadable.length; i++) {
      const item = uploadable[i];

      // Mark as uploading
      updateItem(item.id, { status: "uploading" });

      try {
        const response = await bulkSubmitDeliverables([item.file], [
          {
            assignment_id: item.assignmentId,
            title: item.title || item.file.name,
            notes: item.notes || undefined,
          },
        ]);

        const result: BulkSubmitFileResult = response.results[0];
        if (result.success) {
          updateItem(item.id, {
            status: "success",
            deliverableId: result.deliverable_id,
            error: null,
          });
          succeeded++;
        } else {
          updateItem(item.id, {
            status: "error",
            error: result.error ?? "Upload failed",
          });
          failed++;
        }
      } catch {
        updateItem(item.id, {
          status: "error",
          error: "Network error — please try again",
        });
        failed++;
      }

      setUploadProgress(Math.round(((i + 1) / uploadable.length) * 100));
    }

    setIsUploading(false);

    const result = { succeeded, failed };
    setSummary(result);

    // Invalidate deliverables cache so the list page refreshes
    await queryClient.invalidateQueries({ queryKey: ["partner-portal", "deliverables"] });

    if (succeeded > 0) {
      toast.success(
        `${succeeded} file${succeeded !== 1 ? "s" : ""} submitted successfully`
      );
    }
    if (failed > 0) {
      toast.error(`${failed} file${failed !== 1 ? "s" : ""} failed to upload`);
    }

    onComplete?.(result);
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const readyCount = queue.filter((i) => i.status === "pending" && i.assignmentId).length;
  const invalidCount = queue.filter((i) => i.status === "invalid").length;
  const unassignedCount = queue.filter(
    (i) => i.status === "pending" && !i.assignmentId
  ).length;
  const hasUploadable = readyCount > 0;
  const allDone =
    queue.length > 0 &&
    queue.every((i) => ["success", "error", "invalid"].includes(i.status));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={[
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
          isUploading ? "pointer-events-none opacity-60" : "",
        ].join(" ")}
      >
        <CloudUpload className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-base font-medium">
          {isDragging ? "Drop files here" : "Drag & drop files here"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          or click to select multiple files
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          {ALLOWED_EXTENSIONS.join(", ")} · Max {MAX_FILE_SIZE_MB} MB per file
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          accept={ALLOWED_EXTENSIONS.join(",")}
          onChange={handleInputChange}
          disabled={isUploading}
        />
      </div>

      {/* File queue */}
      {queue.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              {queue.length} file{queue.length !== 1 ? "s" : ""} queued
              {readyCount > 0 && (
                <span className="ml-2 text-foreground">
                  · {readyCount} ready
                </span>
              )}
              {invalidCount > 0 && (
                <span className="ml-2 text-destructive">
                  · {invalidCount} invalid
                </span>
              )}
              {unassignedCount > 0 && (
                <span className="ml-2 text-orange-600 dark:text-orange-400">
                  · {unassignedCount} unassigned
                </span>
              )}
            </p>
            {!isUploading && !allDone && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQueue([])}
                className="text-muted-foreground"
              >
                Clear all
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {queue.map((item) => (
              <FileRow
                key={item.id}
                item={item}
                assignments={acceptedAssignments}
                disabled={isUploading}
                onRemove={() => removeItem(item.id)}
                onUpdate={(patch) => updateItem(item.id, patch)}
                onToggleExpand={() => toggleExpanded(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upload progress bar */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Uploading files…</span>
            <span className="font-medium">{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}

      {/* Completion summary */}
      {summary && allDone && (
        <Card
          className={summary.failed === 0 ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30" : "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30"}
        >
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-base">Upload Complete</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="font-semibold">{summary.succeeded}</span>
                <span className="text-sm text-muted-foreground">succeeded</span>
              </div>
              {summary.failed > 0 && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <span className="font-semibold">{summary.failed}</span>
                  <span className="text-sm text-muted-foreground">failed</span>
                </div>
              )}
            </div>
            {summary.failed > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Fix the errors above and retry the failed files individually.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* No accepted assignments warning */}
      {acceptedAssignments.length === 0 && queue.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            You have no accepted assignments. Accept an assignment first before submitting
            deliverables.
          </AlertDescription>
        </Alert>
      )}

      {/* Action row */}
      {queue.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {hasUploadable
              ? `${readyCount} file${readyCount !== 1 ? "s" : ""} will be submitted`
              : "No files are ready — assign each file to an accepted assignment"}
          </p>
          <Button
            onClick={handleUpload}
            disabled={!hasUploadable || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Submit {readyCount > 0 ? readyCount : ""} File{readyCount !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── FileRow sub-component ─────────────────────────────────────────────────────

interface FileRowProps {
  item: FileQueueItem;
  assignments: { id: string; title: string; status: string; program_title?: string | null }[];
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

  const isDone = item.status === "success" || item.status === "error" || item.status === "invalid";
  const canExpand = !isDone || item.status === "error";

  return (
    <div className={`rounded-lg border ${rowBg} transition-colors`}>
      {/* Row header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />

        {/* Filename + size */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.file.name}</p>
          <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
        </div>

        {/* Assignment selector (collapsed view) */}
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

        {/* Status badge */}
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

        {/* Status icon */}
        {statusIcon && <div className="shrink-0">{statusIcon}</div>}

        {/* Expand toggle */}
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

        {/* Remove button */}
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

      {/* Expanded details panel */}
      {item.expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          {/* Error message */}
          {item.error && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">{item.error}</AlertDescription>
            </Alert>
          )}

          {item.status === "pending" && (
            <>
              {/* Assignment selector (expanded) */}
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

              {/* Title */}
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

              {/* Notes */}
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
