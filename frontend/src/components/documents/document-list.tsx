"use client";

import * as React from "react";
import { Download, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUploadZone } from "@/components/documents/file-upload-zone";
import { useDocuments, useUploadDocument, useDeleteDocument } from "@/hooks/use-documents";
import { getDocumentDownloadUrl } from "@/lib/api/documents";
import type { DocumentCategory } from "@/types/document";

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

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface DocumentListProps {
  entityType: string;
  entityId: string;
  showUpload?: boolean;
  showDelete?: boolean;
}

export function DocumentList({
  entityType,
  entityId,
  showUpload = true,
  showDelete = true,
}: DocumentListProps) {
  const { data, isLoading } = useDocuments(entityType, entityId);
  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();

  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [category, setCategory] = React.useState<string>("general");
  const [description, setDescription] = React.useState("");
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  function handleUpload() {
    if (!file) return;
    uploadMutation.mutate(
      {
        file,
        entityType,
        entityId,
        category,
        description: description || undefined,
      },
      {
        onSuccess: () => {
          setUploadOpen(false);
          setFile(null);
          setCategory("general");
          setDescription("");
        },
      },
    );
  }

  function handleDownload(docId: string) {
    getDocumentDownloadUrl(docId).then(({ download_url }) => {
      window.open(download_url, "_blank");
    });
  }

  function handleDelete() {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, {
      onSuccess: () => setDeleteId(null),
    });
  }

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading documents...</p>;
  }

  const documents = data?.documents ?? [];

  return (
    <div className="space-y-4">
      {showUpload && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="size-4" />
            Upload Document
          </Button>
        </div>
      )}

      {documents.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No documents yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="max-w-[200px] truncate font-medium">
                  {doc.file_name}
                </TableCell>
                <TableCell>{doc.content_type}</TableCell>
                <TableCell>{formatBytes(doc.file_size)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{doc.category}</Badge>
                </TableCell>
                <TableCell>{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDownload(doc.id)}
                    >
                      <Download className="size-3" />
                    </Button>
                    {showDelete && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setDeleteId(doc.id)}
                      >
                        <Trash2 className="size-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FileUploadZone
              onFileSelect={setFile}
              isUploading={uploadMutation.isPending}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this document? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
