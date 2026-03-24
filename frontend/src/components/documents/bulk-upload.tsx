"use client";

import * as React from "react";
import { CheckCircle2, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UploadZone } from "@/components/documents/upload-zone";
import { uploadDocumentWithProgress } from "@/lib/api/documents";
import type { DocumentCategory, DocumentItem } from "@/types/document";

// ── Types ─────────────────────────────────────────────────────────────────────

type UploadState = "idle" | "queued" | "uploading" | "done" | "editing";
type FileUploadStatus = "pending" | "uploading" | "success" | "error";

interface FileUploadItem {
  id: string;
  file: File;
  status: FileUploadStatus;
  progress: number;
  category: DocumentCategory;
  description: string;
  result?: DocumentItem;
  error?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: DocumentCategory[] = [
  "general",
  "contract",
  "report",
  "correspondence",
  "compliance",
  "financial",
  "legal",
  "other",
];

// ── Auto-categorization ───────────────────────────────────────────────────────

function autoCategorize(filename: string): DocumentCategory {
  const lower = filename.toLowerCase();
  if (/contract|agreement|mou|nda|terms/.test(lower)) return "contract";
  if (/report|analysis|summary|overview/.test(lower)) return "report";
  if (/compliance|kyc|aml|regulatory|audit/.test(lower)) return "compliance";
  if (/financial|invoice|budget|statement|balance|tax/.test(lower)) return "financial";
  if (/legal|court|judgment|lawsuit|regulation/.test(lower)) return "legal";
  if (/letter|correspondence|email|memo|notice/.test(lower)) return "correspondence";
  return "general";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface BulkUploadProps {
  entityType: string;
  entityId: string;
  onComplete?: (uploaded: DocumentItem[]) => void;
}

export function BulkUpload({ entityType, entityId, onComplete }: BulkUploadProps) {
  const [uploadState, setUploadState] = React.useState<UploadState>("idle");
  const [items, setItems] = React.useState<FileUploadItem[]>([]);
  const [globalCategory, setGlobalCategory] = React.useState<DocumentCategory>("general");
  const [autoCategorizeEnabled, setAutoCategorizeEnabled] = React.useState(true);

  // ── File selection ──────────────────────────────────────────────────────────

  function handleFilesSelect(files: File[]) {
    const newItems: FileUploadItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "pending",
      progress: 0,
      category: autoCategorizeEnabled ? autoCategorize(file.name) : globalCategory,
      description: "",
    }));
    setItems((prev) => [...prev, ...newItems]);
    setUploadState("queued");
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (next.length === 0) setUploadState("idle");
      return next;
    });
  }

  // ── Global category application ─────────────────────────────────────────────

  function applyGlobalCategory(cat: DocumentCategory) {
    setGlobalCategory(cat);
    setItems((prev) => prev.map((item) => ({ ...item, category: cat })));
  }

  // ── Upload logic ────────────────────────────────────────────────────────────

  async function startUpload(itemsToUpload?: FileUploadItem[]) {
    const targets = itemsToUpload ?? items;
    if (targets.length === 0) return;

    setUploadState("uploading");

    // Mark targets as uploading
    const targetIds = new Set(targets.map((i) => i.id));
    setItems((prev) =>
      prev.map((item) =>
        targetIds.has(item.id) ? { ...item, status: "uploading", progress: 0, error: undefined } : item,
      ),
    );

    for (const item of targets) {
      try {
        const result = await uploadDocumentWithProgress(
          item.file,
          entityType,
          entityId,
          item.category,
          item.description || undefined,
          (percent) => {
            setItems((prev) =>
              prev.map((i) => (i.id === item.id ? { ...i, progress: percent } : i)),
            );
          },
        );
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "success", progress: 100, result } : i,
          ),
        );
      } catch (err) {
        const error = err instanceof Error ? err.message : "Upload failed";
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "error", error } : i)),
        );
      }
    }

    setUploadState("editing");
  }

  function retryFailed() {
    const failed = items.filter((i) => i.status === "error");
    startUpload(failed);
  }

  function handleDone() {
    const uploaded = items.filter((i) => i.result).map((i) => i.result!);
    onComplete?.(uploaded);
  }

  // ── Per-item editing ────────────────────────────────────────────────────────

  function updateItemCategory(id: string, category: DocumentCategory) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, category } : i)));
  }

  function updateItemDescription(id: string, description: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, description } : i)));
  }

  // ── Derived state ───────────────────────────────────────────────────────────

  const failedCount = items.filter((i) => i.status === "error").length;
  const successCount = items.filter((i) => i.status === "success").length;
  const pendingItems = items.filter((i) => i.status === "pending");

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Bulk Upload Documents</DialogTitle>
      </DialogHeader>

      {/* Drop zone — shown when idle or queued */}
      {(uploadState === "idle" || uploadState === "queued") && (
        <UploadZone onFilesSelect={handleFilesSelect} />
      )}

      {/* File queue — shown when queued */}
      {uploadState === "queued" && items.length > 0 && (
        <div className="space-y-3">
          {/* Global controls */}
          <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Apply to all:</span>
            <Select
              value={globalCategory}
              onValueChange={(v) => applyGlobalCategory(v as DocumentCategory)}
            >
              <SelectTrigger className="h-7 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="text-xs">
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                className="size-3"
                checked={autoCategorizeEnabled}
                onChange={(e) => setAutoCategorizeEnabled(e.target.checked)}
              />
              Auto-categorize by filename
            </label>

            <Badge variant="secondary" className="ml-auto">
              {items.length} file{items.length !== 1 ? "s" : ""} queued
            </Badge>
          </div>

          {/* File list */}
          <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{item.file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatBytes(item.file.size)}
                </span>
                <Select
                  value={item.category}
                  onValueChange={(v) => updateItemCategory(item.id, v as DocumentCategory)}
                >
                  <SelectTrigger className="h-7 w-32 shrink-0 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs">
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => removeItem(item.id)}
                  className="shrink-0"
                >
                  <XCircle className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload progress — shown while uploading */}
      {uploadState === "uploading" && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Uploading files…</p>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {items.map((item) => (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  {item.status === "uploading" && (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                  )}
                  {item.status === "success" && (
                    <CheckCircle2 className="size-3.5 shrink-0 text-green-600" />
                  )}
                  {item.status === "error" && (
                    <XCircle className="size-3.5 shrink-0 text-destructive" />
                  )}
                  {item.status === "pending" && (
                    <div className="size-3.5 shrink-0 rounded-full border border-muted-foreground/40" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium">{item.file.name}</span>
                  <span className="shrink-0 text-muted-foreground">{item.progress}%</span>
                </div>
                {(item.status === "uploading" || item.status === "success") && (
                  <Progress value={item.progress} className="h-1.5" />
                )}
                {item.status === "error" && item.error && (
                  <p className="pl-5 text-xs text-destructive">{item.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Post-upload summary / editing — shown after uploads complete */}
      {(uploadState === "editing" || uploadState === "done") && (
        <div className="space-y-3">
          {/* Summary badges */}
          <div className="flex flex-wrap items-center gap-2">
            {successCount > 0 && (
              <Badge variant="secondary" className="gap-1 text-green-700">
                <CheckCircle2 className="size-3" />
                {successCount} uploaded
              </Badge>
            )}
            {failedCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="size-3" />
                {failedCount} failed
              </Badge>
            )}
          </div>

          {/* Editable table */}
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.id}
                className={`space-y-2 rounded-md border p-3 text-sm ${
                  item.status === "error" ? "border-destructive/50 bg-destructive/5" : "bg-background"
                }`}
              >
                <div className="flex items-center gap-2">
                  {item.status === "success" && (
                    <CheckCircle2 className="size-3.5 shrink-0 text-green-600" />
                  )}
                  {item.status === "error" && (
                    <XCircle className="size-3.5 shrink-0 text-destructive" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium">{item.file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatBytes(item.file.size)}
                  </span>
                </div>

                {item.status === "error" && item.error && (
                  <p className="text-xs text-destructive">{item.error}</p>
                )}

                {item.status === "success" && (
                  <div className="flex gap-2">
                    <Select
                      value={item.category}
                      onValueChange={(v) => updateItemCategory(item.id, v as DocumentCategory)}
                    >
                      <SelectTrigger className="h-7 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c} className="text-xs">
                            {c.charAt(0).toUpperCase() + c.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={item.description}
                      onChange={(e) => updateItemDescription(item.id, e.target.value)}
                      placeholder="Description (optional)"
                      className="h-7 flex-1 text-xs"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <DialogFooter className="gap-2">
        {uploadState === "queued" && (
          <>
            <Button
              variant="outline"
              onClick={() => {
                setItems([]);
                setUploadState("idle");
              }}
            >
              Clear
            </Button>
            <Button onClick={() => startUpload()} disabled={pendingItems.length === 0}>
              Upload {items.length} file{items.length !== 1 ? "s" : ""}
            </Button>
          </>
        )}

        {uploadState === "uploading" && (
          <Button variant="outline" disabled>
            <Loader2 className="size-4 animate-spin" />
            Uploading…
          </Button>
        )}

        {(uploadState === "editing" || uploadState === "done") && (
          <>
            {failedCount > 0 && (
              <Button variant="outline" onClick={retryFailed} className="gap-1.5">
                <RefreshCw className="size-3.5" />
                Retry {failedCount} failed
              </Button>
            )}
            <Button onClick={handleDone}>
              Done
            </Button>
          </>
        )}
      </DialogFooter>
    </div>
  );
}
