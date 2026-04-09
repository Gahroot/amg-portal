"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { usePartnerAssignments, useDownloadDocument } from "@/hooks/use-partner-portal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download, Search, Folder, File, FileImage, FileSpreadsheet, FileArchive } from "lucide-react";
import type { Assignment } from "@/lib/api/assignments";
import type { DocumentItem } from "@/types/document";

interface DocumentEntry {
  doc: DocumentItem;
  assignment: { id: string; title: string };
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return <FileImage className="h-5 w-5 text-purple-600 dark:text-purple-400" />;
  if (contentType.includes("spreadsheet") || contentType.includes("excel")) return <FileSpreadsheet className="h-5 w-5 text-green-600 dark:text-green-400" />;
  if (contentType.includes("pdf")) return <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />;
  if (contentType.includes("zip") || contentType.includes("archive")) return <FileArchive className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

export default function PartnerDocumentsPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");

  const { data: assignmentsData, isLoading: assignmentsLoading } = usePartnerAssignments();
  const downloadMutation = useDownloadDocument();

  const { data: allDocuments, isLoading: docsLoading } = useQuery({
    queryKey: ["partner-portal", "all-documents", assignmentsData?.assignments?.map((a: Assignment) => a.id)],
    queryFn: async (): Promise<DocumentEntry[]> => {
      if (!assignmentsData?.assignments) return [];
      const results: DocumentEntry[] = [];
      for (const assignment of assignmentsData.assignments) {
        try {
          const response = await fetch("/api/v1/partner-portal/assignments/" + assignment.id + "/documents", {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            for (const doc of data.documents || []) {
              results.push({ doc, assignment: { id: assignment.id, title: assignment.title } });
            }
          }
        } catch { /* skip */ }
      }
      return results;
    },
    enabled: !!assignmentsData?.assignments?.length,
  });

  const isLoading = assignmentsLoading || docsLoading;
  const docs = useMemo(() => allDocuments ?? [], [allDocuments]);

  const categories = useMemo(() => Array.from(new Set(docs.map((d: DocumentEntry) => d.doc.category))), [docs]);

  const filtered = useMemo(() => {
    let result = docs;
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter((item: DocumentEntry) =>
        item.doc.file_name.toLowerCase().includes(searchLower) ||
        item.assignment.title.toLowerCase().includes(searchLower) ||
        item.doc.description?.toLowerCase().includes(searchLower)
      );
    }
    if (categoryFilter !== "all") {
      result = result.filter((item: DocumentEntry) => item.doc.category === categoryFilter);
    }
    if (assignmentFilter !== "all") {
      result = result.filter((item: DocumentEntry) => item.assignment.id === assignmentFilter);
    }
    return result;
  }, [docs, search, categoryFilter, assignmentFilter]);

  if (isLoading) {
    return <div className="mx-auto max-w-5xl"><p className="text-muted-foreground text-sm">Loading documents...</p></div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground">Brief documents and requirements from your assignments</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-lg"><Folder className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Total Documents</p><p className="text-2xl font-bold">{docs.length}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div><div><p className="text-sm text-muted-foreground">Assignments</p><p className="text-2xl font-bold">{assignmentsData?.total ?? 0}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg"><FileText className="h-5 w-5 text-green-600 dark:text-green-400" /></div><div><p className="text-sm text-muted-foreground">Categories</p><p className="text-2xl font-bold">{categories.length}</p></div></div></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat: string) => <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Assignment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignments</SelectItem>
            {assignmentsData?.assignments.map((a: Assignment) => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No documents found</h3>
            <p className="text-sm text-muted-foreground">{docs.length === 0 ? "Documents from your assignments will appear here." : "Try adjusting your filters."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Assignment</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item: DocumentEntry) => (
                <TableRow key={item.doc.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {getFileIcon(item.doc.content_type)}
                      <div>
                        <p className="font-medium">{item.doc.file_name}</p>
                        {item.doc.description && <p className="text-xs text-muted-foreground line-clamp-1">{item.doc.description}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Link href={"/partner/inbox/" + item.assignment.id} className="text-sm hover:underline text-primary">{item.assignment.title}</Link></TableCell>
                  <TableCell><Badge variant="secondary">{item.doc.category}</Badge></TableCell>
                  <TableCell>{formatBytes(item.doc.file_size)}</TableCell>
                  <TableCell>{new Date(item.doc.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => downloadMutation.mutate(item.doc.id)} disabled={downloadMutation.isPending}>
                      <Download className="h-4 w-4 mr-1" />Download
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-sm text-muted-foreground">{filtered.length} document{filtered.length !== 1 ? "s" : ""}{filtered.length !== docs.length && " of " + docs.length + " total"}</p>
    </div>
  );
}
