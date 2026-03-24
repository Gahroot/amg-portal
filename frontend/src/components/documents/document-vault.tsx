"use client";

import * as React from "react";
import { Download, Shield, ShieldCheck, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVaultDocuments } from "@/hooks/use-documents";
import type { VaultDocument } from "@/types/document-delivery";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function VaultStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "sealed":
      return (
        <Badge variant="destructive" className="gap-1">
          <ShieldCheck className="size-3" />
          Sealed
        </Badge>
      );
    case "archived":
      return (
        <Badge variant="secondary" className="gap-1">
          <Archive className="size-3" />
          Archived
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1">
          <Shield className="size-3" />
          Active
        </Badge>
      );
  }
}

export function DocumentVault() {
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const { data, isLoading } = useVaultDocuments(
    statusFilter === "all" ? undefined : statusFilter,
  );

  if (isLoading) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Loading vault documents...
      </p>
    );
  }

  const documents: VaultDocument[] = data?.documents ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Filter by status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="sealed">Sealed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="active">Active</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          {data?.total ?? 0} document(s)
        </p>
      </div>

      {documents.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No vault documents found.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sealed At</TableHead>
              <TableHead>Retention</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="max-w-[200px] truncate font-medium">
                  {doc.file_name}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{doc.category}</Badge>
                </TableCell>
                <TableCell>
                  <VaultStatusBadge status={doc.vault_status} />
                </TableCell>
                <TableCell>
                  {doc.sealed_at
                    ? new Date(doc.sealed_at).toLocaleDateString()
                    : "—"}
                </TableCell>
                <TableCell>{doc.retention_policy ?? "—"}</TableCell>
                <TableCell>{formatBytes(doc.file_size)}</TableCell>
                <TableCell>
                  {doc.download_url && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => window.open(doc.download_url!, "_blank")}
                      title="Download"
                    >
                      <Download className="size-3" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
