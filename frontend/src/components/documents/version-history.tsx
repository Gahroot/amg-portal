"use client";

import { useState } from "react";
import { Download, GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VersionCompare } from "@/components/documents/version-compare";
import { useDocumentVersions } from "@/hooks/use-documents";
import { getDocumentDownloadUrl } from "@/lib/api/documents";
import type { DocumentVersionItem } from "@/types/document";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface VersionHistoryProps {
  documentId: string;
  fileName: string;
}

export function VersionHistory({ documentId, fileName }: VersionHistoryProps) {
  const { data, isLoading } = useDocumentVersions(documentId, true);
  const [selected, setSelected] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  if (isLoading) {
    return <p className="py-2 text-xs text-muted-foreground">Loading version history…</p>;
  }

  const versions: DocumentVersionItem[] = data?.versions ?? [];

  if (versions.length === 0) {
    return <p className="py-2 text-xs text-muted-foreground">No versions found.</p>;
  }

  if (versions.length === 1) {
    return <p className="py-2 text-xs text-muted-foreground">No previous versions.</p>;
  }

  function handleToggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) {
        return prev.filter((v) => v !== id);
      }
      if (prev.length < 2) {
        return [...prev, id];
      }
      // Replace the oldest (first) selection
      return [prev[1], id];
    });
  }

  function handleDownload(version: DocumentVersionItem) {
    if (version.download_url) {
      window.open(version.download_url, "_blank");
    } else {
      getDocumentDownloadUrl(version.id).then(({ download_url }) => {
        window.open(download_url, "_blank");
      });
    }
  }

  const canCompare = selected.length === 2;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Version History: {fileName}
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={!canCompare}
          onClick={() => setCompareOpen(true)}
          className="h-7 gap-1.5 text-xs"
        >
          <GitCompare className="size-3" />
          Compare Selected ({selected.length}/2)
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Size</TableHead>
            <TableHead className="w-32 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.map((v) => (
            <TableRow key={v.id}>
              <TableCell className="font-mono text-xs font-medium">v{v.version}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(v.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "2-digit",
                })}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatBytes(v.file_size)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleDownload(v)}
                    title="Download this version"
                  >
                    <Download className="size-3" />
                  </Button>
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id={`select-${v.id}`}
                      checked={selected.includes(v.id)}
                      onCheckedChange={() => handleToggle(v.id)}
                      aria-label={`Select version ${v.version} for comparison`}
                    />
                    <label
                      htmlFor={`select-${v.id}`}
                      className="cursor-pointer text-xs text-muted-foreground"
                    >
                      Select
                    </label>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {canCompare && (
        <VersionCompare
          versionAId={selected[0]}
          versionBId={selected[1]}
          open={compareOpen}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </div>
  );
}
