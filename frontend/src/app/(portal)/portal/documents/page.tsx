"use client";

import * as React from "react";
import Link from "next/link";
import { Download, FileText, File, FileImage, FileSpreadsheet, FileArchive, PenLine, Search, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePortalDocuments } from "@/hooks/use-portal-documents";
import { getDocumentDownloadUrl } from "@/lib/api/documents";
import { ShareDocumentDialog } from "@/components/portal/share-document-dialog";
import type { DocumentItem } from "@/types/document";

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  contract: "Contract",
  report: "Report",
  correspondence: "Correspondence",
  compliance: "Compliance",
  financial: "Financial",
  legal: "Legal",
  other: "Other",
};

const CATEGORY_GROUP: Record<string, string> = {
  contract: "Contracts",
  legal: "Contracts",
  compliance: "Compliance",
  financial: "Financial",
  report: "Program Documents",
  general: "Program Documents",
  correspondence: "Program Documents",
  other: "Program Documents",
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(contentType: string | null) {
  if (!contentType) return <File className="h-5 w-5 text-muted-foreground" />;
  if (contentType.startsWith("image/")) return <FileImage className="h-5 w-5 text-purple-600 dark:text-purple-400" />;
  if (contentType.includes("spreadsheet") || contentType.includes("excel"))
    return <FileSpreadsheet className="h-5 w-5 text-green-600 dark:text-green-400" />;
  if (contentType.includes("pdf")) return <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />;
  if (contentType.includes("zip") || contentType.includes("archive"))
    return <FileArchive className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function handleDownload(docId: string) {
  getDocumentDownloadUrl(docId).then(({ download_url }) => {
    window.open(download_url, "_blank");
  });
}

interface DocumentTableProps {
  documents: DocumentItem[];
  onShare: (doc: DocumentItem) => void;
}

function DocumentTable({ documents, onShare }: DocumentTableProps) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Document</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  {getFileIcon(doc.content_type)}
                  <div>
                    <p className="font-medium leading-tight">{doc.file_name}</p>
                    {doc.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {doc.description}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {CATEGORY_LABELS[doc.category] ?? doc.category}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatBytes(doc.file_size)}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {new Date(doc.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(doc.id)}
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Link href={`/portal/documents/signing/${doc.id}`}>
                    <Button variant="ghost" size="sm" title="Sign / Acknowledge">
                      <PenLine className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onShare(doc)}
                    title="Share document"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function PortalDocumentsPage() {
  const { data, isLoading } = usePortalDocuments();
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [shareDoc, setShareDoc] = React.useState<DocumentItem | null>(null);

  const documents = data?.documents ?? [];

  const filtered = React.useMemo(() => {
    let result = documents;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.file_name.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q),
      );
    }
    if (categoryFilter !== "all") {
      result = result.filter((d) => d.category === categoryFilter);
    }
    return result;
  }, [documents, search, categoryFilter]);

  const categories = React.useMemo(
    () => Array.from(new Set(documents.map((d) => d.category))),
    [documents],
  );

  // Group filtered documents by logical group
  const groups = React.useMemo(() => {
    const map = new Map<string, DocumentItem[]>();
    for (const doc of filtered) {
      const group = CATEGORY_GROUP[doc.category] ?? "Program Documents";
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(doc);
    }
    return map;
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="font-serif text-3xl font-bold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Your compliance documents, contracts, and program materials
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_LABELS[cat] ?? cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1">No documents found</h3>
            <p className="text-sm text-muted-foreground">
              {documents.length === 0
                ? "Documents shared with you will appear here."
                : "Try adjusting your search or filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Array.from(groups.entries()).map(([groupName, docs]) => (
            <div key={groupName} className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {groupName}
              </h2>
              <DocumentTable documents={docs} onShare={setShareDoc} />
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {filtered.length} document{filtered.length !== 1 ? "s" : ""}
        {filtered.length !== documents.length && ` of ${documents.length} total`}
      </p>

      {shareDoc && (
        <ShareDocumentDialog
          documentId={shareDoc.id}
          documentName={shareDoc.file_name}
          open={!!shareDoc}
          onOpenChange={(open) => { if (!open) setShareDoc(null); }}
        />
      )}
    </div>
  );
}
