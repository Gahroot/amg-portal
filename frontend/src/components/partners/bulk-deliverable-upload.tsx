"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePartnerAssignments } from "@/hooks/use-partner-portal";
import {
  bulkSubmitDeliverables,
  type BulkSubmitFileResult,
} from "@/lib/api/partner-portal";
import { DeliverableDropZone } from "./deliverable-drop-zone";
import { DeliverableFileList } from "./deliverable-file-list";
import { DeliverableUploadProgress } from "./deliverable-upload-progress";
import {
  validateFile,
  autoMatchAssignment,
  type FileQueueItem,
} from "./deliverable-upload-types";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface BulkDeliverableUploadProps {
  /** Called after successful submission so the parent can navigate away */
  onComplete?: (result: { succeeded: number; failed: number }) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BulkDeliverableUpload({ onComplete }: BulkDeliverableUploadProps) {
  const queryClient = useQueryClient();
  const { data: assignmentsData } = usePartnerAssignments({ status: "accepted" });
  const acceptedAssignments = (assignmentsData?.assignments ?? []).filter(
    (a) => a.status === "accepted"
  );

  const [queue, setQueue] = useState<FileQueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [summary, setSummary] = useState<{ succeeded: number; failed: number } | null>(null);

  // ── Queue management ───────────────────────────────────────────────────────

  function addFiles(files: File[]) {
    const newItems: FileQueueItem[] = files.map((file) => {
      const validationError = validateFile(file);
      const matchedId = autoMatchAssignment(file.name, acceptedAssignments);
      return {
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        assignmentId: matchedId,
        title: file.name.replace(/\.[^.]+$/, ""),
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

  // ── Upload ─────────────────────────────────────────────────────────────────

  async function handleUpload() {
    const uploadable = queue.filter((item) => item.status === "pending" && item.assignmentId);

    if (uploadable.length === 0) {
      toast.error("No valid files ready to upload. Assign each file to an accepted assignment.");
      return;
    }

    setIsUploading(true);
    setSummary(null);
    setUploadProgress(0);

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < uploadable.length; i++) {
      const item = uploadable[i];
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
          updateItem(item.id, { status: "success", deliverableId: result.deliverable_id, error: null });
          succeeded++;
        } else {
          updateItem(item.id, { status: "error", error: result.error ?? "Upload failed" });
          failed++;
        }
      } catch {
        updateItem(item.id, { status: "error", error: "Network error — please try again" });
        failed++;
      }

      setUploadProgress(Math.round(((i + 1) / uploadable.length) * 100));
    }

    setIsUploading(false);
    const result = { succeeded, failed };
    setSummary(result);

    await queryClient.invalidateQueries({ queryKey: ["partner-portal", "deliverables"] });

    if (succeeded > 0) toast.success(`${succeeded} file${succeeded !== 1 ? "s" : ""} submitted successfully`);
    if (failed > 0) toast.error(`${failed} file${failed !== 1 ? "s" : ""} failed to upload`);

    onComplete?.(result);
  }

  // ── Derived state (single pass) ───────────────────────────────────────────

  let readyCount = 0;
  let allDone = queue.length > 0;
  for (const i of queue) {
    if (i.status === "pending" && i.assignmentId) readyCount++;
    if (!["success", "error", "invalid"].includes(i.status)) allDone = false;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <DeliverableDropZone onFilesSelected={addFiles} disabled={isUploading} />

      {queue.length > 0 && (
        <DeliverableFileList
          files={queue}
          assignments={acceptedAssignments}
          disabled={isUploading}
          onRemove={removeItem}
          onUpdate={updateItem}
          onToggleExpand={toggleExpanded}
          onClearAll={() => setQueue([])}
        />
      )}

      {isUploading && <DeliverableUploadProgress progress={uploadProgress} />}

      {summary && allDone && (
        <Card
          className={
            summary.failed === 0
              ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30"
              : "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30"
          }
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

      {acceptedAssignments.length === 0 && queue.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            You have no accepted assignments. Accept an assignment first before submitting
            deliverables.
          </AlertDescription>
        </Alert>
      )}

      {queue.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {readyCount > 0
              ? `${readyCount} file${readyCount !== 1 ? "s" : ""} will be submitted`
              : "No files are ready — assign each file to an accepted assignment"}
          </p>
          <Button onClick={handleUpload} disabled={readyCount === 0 || isUploading}>
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
