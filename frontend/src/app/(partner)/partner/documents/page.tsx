"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { usePartnerAssignments, useDownloadDocument } from "@/hooks/use-partner-portal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DocumentItem } from "@/types/document";
import { FileText, Download, Search, Folder, File, FileImage, FileSpreadsheet, FileArchive, FileSignature, CheckCircle2, Clock, Eye } from "lucide-react";
import { usePartnerEnvelopes } from "@/hooks/use-envelopes";
import type { EnvelopeStatus } from "@/types/document";

interface DocumentWithAssignment {
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
  if (contentType.startsWith("image/")) return <FileImage className="h-5 w-5 text-purple-600" />;
  if (contentType.includes("spreadsheet") || contentType.includes("excel")) return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
  if (contentType.includes("pdf")) return <FileText className="h-5 w-5 text-red-600" />;
  if (contentType.includes("zip") || contentType.includes("archive")) return <FileArchive className="h-5 w-5 text-yellow-600" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

export default function PartnerDocumentsPage() {
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [assignmentFilter, setAssignmentFilter] = React.useState("all");

  const { data: assignmentsData, isLoading: assignmentsLoading } = usePartnerAssignments();
  const downloadMutation = useDownloadDocument();

  const { data: allDocuments, isLoading: docsLoading } = useQuery({
    queryKey: ["partner-portal", "all-documents", assignmentsData?.assignments?.map((a) => a.id)],
    queryFn: async () => {
      if (!assignmentsData?.assignments) return [];
      const results: DocumentWithAssignment[] = [];
      for (const assignment of assignmentsData.assignments) {
        try {
          const response = await fetch("/api/v1/partner-portal/assignments/" + assignment.id + "/documents", {
            headers: { Authorization: "Bearer " + localStorage.getItem("access_token") },
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
  const docs = allDocuments ?? [];

  const categories = React.useMemo(() => Array.from(new Set(docs.map((d) => d.doc.category))), [docs]);

  const filtered = React.useMemo(() => {
    let result = docs;
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter((item) =>
        item.doc.file_name.toLowerCase().includes(searchLower) ||
        item.assignment.title.toLowerCase().includes(searchLower) ||
        item.doc.description?.toLowerCase().includes(searchLower)
      );
    }
    if (categoryFilter !== "all") {
      result = result.filter((item) => item.doc.category === categoryFilter);
    }
    if (assignmentFilter !== "all") {
      result = result.filter((item) => item.assignment.id === assignmentFilter);
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
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="p-2 bg-blue-100 rounded-lg"><FileText className="h-5 w-5 text-blue-600" /></div><div><p className="text-sm text-muted-foreground">Assignments</p><p className="text-2xl font-bold">{assignmentsData?.total ?? 0}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="p-2 bg-green-100 rounded-lg"><FileText className="h-5 w-5 text-green-600" /></div><div><p className="text-sm text-muted-foreground">Categories</p><p className="text-2xl font-bold">{categories.length}</p></div></div></CardContent></Card>
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
            {assignmentsData?.assignments.map((a) => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}
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
        <div className="rounded-md border bg-white">
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
              {filtered.map((item) => (
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

      {/* Agreements / E-Signing Section */}
      <PartnerAgreementsSection />
    </div>
  );
}

const ENVELOPE_STATUS_BADGE: Record<EnvelopeStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  created: { label: "Created", variant: "outline" },
  sent: { label: "Awaiting Signature", variant: "secondary" },
  delivered: { label: "Delivered", variant: "secondary" },
  signed: { label: "Signed", variant: "default" },
  completed: { label: "Completed", variant: "default" },
  declined: { label: "Declined", variant: "destructive" },
  voided: { label: "Voided", variant: "destructive" },
  expired: { label: "Expired", variant: "outline" },
};

function PartnerAgreementsSection() {
  const { data, isLoading, error } = usePartnerEnvelopes();

  // Don't show section if DocuSign is not configured (503 error)
  if (error) return null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-serif text-xl font-bold tracking-tight">Agreements</h2>
          <p className="text-sm text-muted-foreground">Documents requiring your signature</p>
        </div>
        <p className="text-sm text-muted-foreground">Loading agreements…</p>
      </div>
    );
  }

  const envelopes = data?.envelopes ?? [];
  if (envelopes.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-xl font-bold tracking-tight">Agreements</h2>
        <p className="text-sm text-muted-foreground">Documents requiring your signature</p>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {envelopes.map((envelope) => {
              const signable = envelope.status === "sent" || envelope.status === "delivered";
              const config = ENVELOPE_STATUS_BADGE[envelope.status] ?? ENVELOPE_STATUS_BADGE.created;

              return (
                <TableRow key={envelope.id}>
                  <TableCell className="font-medium max-w-[250px] truncate">
                    {envelope.subject}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {envelope.sender_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant={config.variant} className="gap-1">
                      {signable ? <Clock className="size-3" /> : <CheckCircle2 className="size-3" />}
                      {config.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {envelope.sent_at ? new Date(envelope.sent_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={signable ? "default" : "ghost"}
                      asChild
                    >
                      <Link href={`/partner/documents/signing/${envelope.id}`}>
                        {signable ? (
                          <><FileSignature className="mr-1 size-3" />Sign</>
                        ) : (
                          <><Eye className="mr-1 size-3" />View</>
                        )}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
