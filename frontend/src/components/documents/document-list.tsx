"use client";

import * as React from "react";
import { Download, Trash2, Plus, History, Upload, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTableExport } from "@/components/ui/data-table-export";
import type { ExportColumn } from "@/lib/export-utils";
import { API_BASE_URL } from "@/lib/constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { BulkUpload } from "@/components/documents/bulk-upload";
import { RequestDocumentDialog } from "@/components/documents/request-document-dialog";
import { VersionHistory } from "@/components/documents/version-history";
import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
} from "@/hooks/use-documents";
import { getDocumentDownloadUrl } from "@/lib/api/documents";
import { useQueryClient } from "@tanstack/react-query";
import type { DocumentCategory, DocumentItem } from "@/types/document";

const DOCUMENT_EXPORT_COLUMNS: ExportColumn<DocumentItem>[] = [
  { header: "File Name", accessor: "file_name" },
  { header: "Content Type", accessor: "content_type" },
  { header: "Size", accessor: (r) => formatBytes(r.file_size) },
  { header: "Category", accessor: "category" },
  { header: "Version", accessor: (r) => `v${r.version}` },
  { header: "Description", accessor: (r) => r.description ?? "" },
  { header: "Uploaded", accessor: (r) => new Date(r.created_at).toLocaleDateString() },
];

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
  /** When true, shows a "Request Document" button (only meaningful for client entities) */
  showRequest?: boolean;
}

export function DocumentList({
  entityType,
  entityId,
  showUpload = true,
  showDelete = true,
  showRequest = false,
}: DocumentListProps) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useDocuments(entityType, entityId);
  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();

  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [requestOpen, setRequestOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [category, setCategory] = React.useState<string>("general");
  const [description, setDescription] = React.useState("");
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [openVersions, setOpenVersions] = React.useState<string[]>([]);

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
      <div className="flex justify-end gap-2">
        {documents.length > 0 && (
          <DataTableExport
            visibleRows={documents}
            columns={DOCUMENT_EXPORT_COLUMNS}
            fileName="documents"
            size="sm"
            exportAllUrl={`${API_BASE_URL}/api/v1/export/documents?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`}
          />
        )}
        {showRequest && (
          <Button size="sm" variant="outline" onClick={() => setRequestOpen(true)}>
            <FileQuestion className="size-4" />
            Request Document
          </Button>
        )}
        {showUpload && (
          <>
            <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
              <Upload className="size-4" />
              Bulk Upload
            </Button>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Plus className="size-4" />
              Upload Document
            </Button>
          </>
        )}
      </div>

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
              <TableHead>Version</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => {
              const isVersionOpen = openVersions.includes(doc.id);
              return (
                <React.Fragment key={doc.id}>
                  <TableRow>
                    <TableCell className="max-w-[180px] truncate font-medium">
                      {doc.file_name}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {doc.content_type}
                    </TableCell>
                    <TableCell>{formatBytes(doc.file_size)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{doc.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">v{doc.version}</Badge>
                    </TableCell>
                    <TableCell>{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleDownload(doc.id)}
                          title="Download latest"
                        >
                          <Download className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() =>
                            setOpenVersions((prev) =>
                              prev.includes(doc.id)
                                ? prev.filter((id) => id !== doc.id)
                                : [...prev, doc.id],
                            )
                          }
                          title="Version history"
                          aria-expanded={isVersionOpen}
                        >
                          <History className="size-3" />
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

                  {isVersionOpen && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/20 px-4 py-3">
                        <Accordion
                          type="single"
                          value="history"
                          className="w-full"
                        >
                          <AccordionItem value="history" className="border-0">
                            <AccordionTrigger className="py-1 text-xs font-medium text-muted-foreground hover:no-underline">
                              Version History
                            </AccordionTrigger>
                            <AccordionContent className="pb-0">
                              <VersionHistory documentId={doc.id} fileName={doc.file_name} />
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
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

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-2xl">
          <BulkUpload
            entityType={entityType}
            entityId={entityId}
            onComplete={() => {
              queryClient.invalidateQueries({ queryKey: ["documents"] });
              setBulkOpen(false);
            }}
          />
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

      {/* Request Document Dialog */}
      {showRequest && (
        <RequestDocumentDialog
          open={requestOpen}
          onOpenChange={setRequestOpen}
          clientId={entityId}
        />
      )}
    </div>
  );
}
