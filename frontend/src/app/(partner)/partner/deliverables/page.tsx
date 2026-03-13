"use client";

import * as React from "react";
import Link from "next/link";
import { usePartnerDeliverables, useSubmitPartnerDeliverable } from "@/hooks/use-partner-portal";
import type { DeliverableItem } from "@/lib/api/deliverables";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, Upload, CheckCircle2, XCircle, AlertCircle, Search, ExternalLink } from "lucide-react";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline", submitted: "secondary", under_review: "secondary",
  approved: "default", returned: "destructive", rejected: "destructive",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />, submitted: <Upload className="h-4 w-4" />,
  under_review: <AlertCircle className="h-4 w-4" />, approved: <CheckCircle2 className="h-4 w-4" />,
  returned: <XCircle className="h-4 w-4" />, rejected: <XCircle className="h-4 w-4" />,
};

function getDueDateDisplay(dateStr: string | null) {
  if (!dateStr) return { text: "-", color: "text-muted-foreground" };
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: "Overdue", color: "text-destructive" };
  if (diffDays === 0) return { text: "Today", color: "text-orange-600" };
  if (diffDays <= 3) return { text: diffDays + "d left", color: "text-orange-600" };
  return { text: date.toLocaleDateString(), color: "text-muted-foreground" };
}

export default function PartnerDeliverablesPage() {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [error, setError] = React.useState<string | null>(null);
  const [uploadingId, setUploadingId] = React.useState<string | null>(null);

  const { data, isLoading } = usePartnerDeliverables(statusFilter !== "all" ? { status: statusFilter } : undefined);
  const submitMutation = useSubmitPartnerDeliverable();

  const handleFileUpload = (deliverableId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingId(deliverableId);
      submitMutation.mutate(
        { id: deliverableId, file },
        {
          onSuccess: () => setUploadingId(null),
          onError: () => { setError("Failed to submit deliverable."); setUploadingId(null); },
        }
      );
    }
  };

  const deliverables = data?.deliverables ?? [];
  const searchLower = search.toLowerCase();
  
  const filtered = search
    ? deliverables.filter(d =>
        d.title.toLowerCase().includes(searchLower) ||
        (d.description?.toLowerCase().includes(searchLower)) ||
        d.deliverable_type.toLowerCase().includes(searchLower)
      )
    : deliverables;

  const pending = filtered.filter(d => d.status === "pending" || d.status === "returned");
  const submitted = filtered.filter(d => d.status === "submitted" || d.status === "under_review");
  const completed = filtered.filter(d => d.status === "approved" || d.status === "rejected");

  if (isLoading) {
    return <div className="mx-auto max-w-5xl"><p className="text-muted-foreground text-sm">Loading deliverables...</p></div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Deliverables</h1>
          <p className="text-sm text-muted-foreground">Track and submit your assignment deliverables</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search deliverables..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64 pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Filter status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Action Required</p><p className="text-2xl font-bold">{pending.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Under Review</p><p className="text-2xl font-bold">{submitted.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Completed</p><p className="text-2xl font-bold">{completed.length}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
          <TabsTrigger value="pending">Action Required ({pending.length})</TabsTrigger>
          <TabsTrigger value="submitted">Under Review ({submitted.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all"><div className="rounded-md border bg-white"><DeliverableTable deliverables={filtered} uploadingId={uploadingId} handleFileUpload={handleFileUpload} /></div></TabsContent>
        <TabsContent value="pending"><div className="rounded-md border bg-white"><DeliverableTable deliverables={pending} uploadingId={uploadingId} handleFileUpload={handleFileUpload} /></div></TabsContent>
        <TabsContent value="submitted"><div className="rounded-md border bg-white"><DeliverableTable deliverables={submitted} uploadingId={uploadingId} handleFileUpload={handleFileUpload} /></div></TabsContent>
        <TabsContent value="completed"><div className="rounded-md border bg-white"><DeliverableTable deliverables={completed} uploadingId={uploadingId} handleFileUpload={handleFileUpload} /></div></TabsContent>
      </Tabs>

      {data && <p className="text-sm text-muted-foreground">{data.total} deliverable{data.total !== 1 ? "s" : ""} total</p>}
    </div>
  );
}

function DeliverableTable({ deliverables, uploadingId, handleFileUpload }: {
  deliverables: DeliverableItem[];
  uploadingId: string | null;
  handleFileUpload: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  if (deliverables.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No deliverables found.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Deliverable</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deliverables.map((deliverable) => {
          const dueDate = getDueDateDisplay(deliverable.due_date);
          return (
            <TableRow key={deliverable.id}>
              <TableCell>
                <div className="space-y-1">
                  <Link href={"/partner/deliverables/" + deliverable.id} className="font-medium hover:underline">
                    {deliverable.title}
                  </Link>
                  {deliverable.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{deliverable.description}</p>
                  )}
                  {deliverable.review_comments && (
                    <p className="text-xs text-orange-600">Review: {deliverable.review_comments}</p>
                  )}
                </div>
              </TableCell>
              <TableCell><Badge variant="outline">{deliverable.deliverable_type}</Badge></TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {STATUS_ICONS[deliverable.status]}
                  <Badge variant={STATUS_VARIANT[deliverable.status] ?? "outline"}>
                    {deliverable.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </TableCell>
              <TableCell><span className={dueDate.color}>{dueDate.text}</span></TableCell>
              <TableCell>
                {deliverable.submitted_at
                  ? new Date(deliverable.submitted_at).toLocaleDateString()
                  : "-"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {(deliverable.status === "pending" || deliverable.status === "returned") && (
                    <div>
                      <Label htmlFor={"file-" + deliverable.id} className="sr-only">Upload file</Label>
                      <Input
                        id={"file-" + deliverable.id}
                        type="file"
                        className="w-[180px]"
                        onChange={(e) => handleFileUpload(deliverable.id, e)}
                        disabled={uploadingId === deliverable.id}
                      />
                      {uploadingId === deliverable.id && (
                        <p className="text-xs text-muted-foreground mt-1">Uploading...</p>
                      )}
                    </div>
                  )}
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={"/partner/deliverables/" + deliverable.id}><ExternalLink className="h-4 w-4" /></Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
