"use client";

import * as React from "react";
import { Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDocumentCompare } from "@/hooks/use-documents";
import { getDocumentDownloadUrl } from "@/lib/api/documents";
import type { DiffLine, DocumentDiffHunk } from "@/types/document";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function lineRowClass(changeType: DiffLine["change_type"]): string {
  if (changeType === "added") return "bg-green-950/40";
  if (changeType === "deleted") return "bg-red-950/40";
  return "bg-muted/10";
}

function lineTextClass(changeType: DiffLine["change_type"]): string {
  if (changeType === "added") return "text-green-300";
  if (changeType === "deleted") return "text-red-300";
  return "text-muted-foreground";
}

function linePrefix(changeType: DiffLine["change_type"]): string {
  if (changeType === "added") return "+";
  if (changeType === "deleted") return "-";
  return " ";
}

interface HunkHeaderProps {
  hunk: DocumentDiffHunk;
}

function HunkHeader({ hunk }: HunkHeaderProps) {
  return (
    <tr>
      <td
        colSpan={4}
        className="bg-muted px-3 py-1 font-mono text-xs text-muted-foreground"
      >
        @@ -{hunk.a_start},{hunk.a_count} +{hunk.b_start},{hunk.b_count} @@
      </td>
    </tr>
  );
}

interface InlineDiffProps {
  hunks: DocumentDiffHunk[];
}

function InlineDiff({ hunks }: InlineDiffProps) {
  return (
    <div className="overflow-x-auto rounded-md border font-mono text-xs">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b bg-muted/40 text-muted-foreground">
            <th className="w-10 px-2 py-1 text-right">Old</th>
            <th className="w-10 px-2 py-1 text-right">New</th>
            <th className="w-5 px-1 py-1 text-center"></th>
            <th className="px-3 py-1 text-left">Content</th>
          </tr>
        </thead>
        <tbody>
          {hunks.map((hunk, hi) => (
            <React.Fragment key={hi}>
              <HunkHeader hunk={hunk} />
              {hunk.lines.map((line, li) => (
                <tr key={li} className={lineRowClass(line.change_type)}>
                  <td className="w-10 select-none px-2 py-0 text-right text-muted-foreground/60">
                    {line.line_number_a ?? ""}
                  </td>
                  <td className="w-10 select-none px-2 py-0 text-right text-muted-foreground/60">
                    {line.line_number_b ?? ""}
                  </td>
                  <td className={`w-5 select-none px-1 py-0 text-center ${lineTextClass(line.change_type)}`}>
                    {linePrefix(line.change_type)}
                  </td>
                  <td className={`whitespace-pre-wrap break-all px-3 py-0 ${lineTextClass(line.change_type)}`}>
                    {line.content}
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface SideBySideDiffProps {
  hunks: DocumentDiffHunk[];
}

function SideBySideDiff({ hunks }: SideBySideDiffProps) {
  // Build paired rows: left=deleted/context, right=added/context
  type PairedRow =
    | { type: "hunk"; hunk: DocumentDiffHunk }
    | { type: "row"; left: DiffLine | null; right: DiffLine | null };

  const rows: PairedRow[] = [];

  for (const hunk of hunks) {
    rows.push({ type: "hunk", hunk });
    const deleted = hunk.lines.filter((l) => l.change_type === "deleted");
    const added = hunk.lines.filter((l) => l.change_type === "added");
    const context = hunk.lines.filter((l) => l.change_type === "context");

    // Interleave context before/after changes
    let di = 0;
    let ai = 0;
    for (const line of hunk.lines) {
      if (line.change_type === "context") {
        rows.push({ type: "row", left: line, right: line });
      } else if (line.change_type === "deleted") {
        const rightLine = added[ai] ?? null;
        if (rightLine) ai++;
        rows.push({ type: "row", left: line, right: rightLine });
        di++;
      } else if (line.change_type === "added") {
        // If we already paired this added line with a delete, skip
        const alreadyPaired = ai <= deleted.length && di > 0 && ai < di;
        if (!alreadyPaired) {
          rows.push({ type: "row", left: null, right: line });
        }
      }
    }
    // Unused: suppress unused var warnings
    void context;
  }

  return (
    <div className="overflow-x-auto rounded-md border font-mono text-xs">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b bg-muted/40 text-muted-foreground">
            <th className="w-10 px-2 py-1 text-right">Old</th>
            <th className="px-3 py-1 text-left">Version A</th>
            <th className="w-10 px-2 py-1 text-right">New</th>
            <th className="px-3 py-1 text-left">Version B</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            if (row.type === "hunk") {
              return (
                <tr key={i}>
                  <td
                    colSpan={4}
                    className="bg-muted px-3 py-1 font-mono text-xs text-muted-foreground"
                  >
                    @@ -{row.hunk.a_start},{row.hunk.a_count} +{row.hunk.b_start},{row.hunk.b_count} @@
                  </td>
                </tr>
              );
            }
            const { left, right } = row;
            return (
              <tr key={i}>
                <td className="select-none px-2 py-0 text-right text-muted-foreground/60">
                  {left?.line_number_a ?? ""}
                </td>
                <td
                  className={`whitespace-pre-wrap break-all px-3 py-0 ${
                    left ? lineRowClass(left.change_type) : ""
                  } ${left ? lineTextClass(left.change_type) : ""}`}
                >
                  {left?.content ?? ""}
                </td>
                <td className="select-none px-2 py-0 text-right text-muted-foreground/60">
                  {right?.line_number_b ?? ""}
                </td>
                <td
                  className={`whitespace-pre-wrap break-all px-3 py-0 ${
                    right ? lineRowClass(right.change_type) : ""
                  } ${right ? lineTextClass(right.change_type) : ""}`}
                >
                  {right?.content ?? ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export interface VersionCompareProps {
  versionAId: string;
  versionBId: string;
  open: boolean;
  onClose: () => void;
}

export function VersionCompare({ versionAId, versionBId, open, onClose }: VersionCompareProps) {
  const { data, isLoading } = useDocumentCompare(versionAId, versionBId, open);

  function handleDownload(id: string, downloadUrl: string | null) {
    if (downloadUrl) {
      window.open(downloadUrl, "_blank");
    } else {
      getDocumentDownloadUrl(id).then(({ download_url }) => window.open(download_url, "_blank"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Compare Versions</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3 py-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {!isLoading && data && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            {/* Summary bar */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                v{data.version_a.version} → v{data.version_b.version}
              </span>
              {data.diff_available && (
                <>
                  <Badge className="bg-green-900/50 text-green-300 hover:bg-green-900/60">
                    +{data.total_additions} addition{data.total_additions !== 1 ? "s" : ""}
                  </Badge>
                  <Badge className="bg-red-900/50 text-red-300 hover:bg-red-900/60">
                    -{data.total_deletions} deletion{data.total_deletions !== 1 ? "s" : ""}
                  </Badge>
                </>
              )}
              {!data.diff_available && (
                <Badge variant="secondary">
                  {data.is_text ? "Diff unavailable (file too large)" : "Binary file"}
                </Badge>
              )}
            </div>

            {/* Text diff */}
            {data.is_text && data.diff_available && data.hunks.length > 0 && (
              <Tabs defaultValue="inline">
                <TabsList className="mb-2">
                  <TabsTrigger value="inline">Inline</TabsTrigger>
                  <TabsTrigger value="side-by-side">Side by side</TabsTrigger>
                </TabsList>
                <TabsContent value="inline">
                  <InlineDiff hunks={data.hunks} />
                </TabsContent>
                <TabsContent value="side-by-side">
                  <SideBySideDiff hunks={data.hunks} />
                </TabsContent>
              </Tabs>
            )}

            {data.is_text && data.diff_available && data.hunks.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No differences found — versions are identical.
              </p>
            )}

            {/* Binary / unavailable */}
            {(!data.is_text || !data.diff_available) && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-md border border-muted bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  <FileText className="size-4 shrink-0" />
                  Content diff not available for this file type.
                </div>

                {/* Metadata comparison */}
                {data.metadata && (
                  <div className="overflow-hidden rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="px-4 py-2 text-left font-medium">Property</th>
                          <th className="px-4 py-2 text-left font-medium">
                            Version {data.version_a.version}
                          </th>
                          <th className="px-4 py-2 text-left font-medium">
                            Version {data.version_b.version}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="px-4 py-2 text-muted-foreground">Size</td>
                          <td className="px-4 py-2">{formatBytes(data.version_a.file_size)}</td>
                          <td className="px-4 py-2">{formatBytes(data.version_b.file_size)}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="px-4 py-2 text-muted-foreground">Uploaded</td>
                          <td className="px-4 py-2">
                            {new Date(data.version_a.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2">
                            {new Date(data.version_b.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="shrink-0 gap-2">
          {data && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  handleDownload(data.version_a.id, data.version_a.download_url)
                }
              >
                <Download className="size-3" />
                Download v{data.version_a.version}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  handleDownload(data.version_b.id, data.version_b.download_url)
                }
              >
                <Download className="size-3" />
                Download v{data.version_b.version}
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
