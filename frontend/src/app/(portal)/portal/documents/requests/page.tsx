"use client";

import * as React from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileQuestion,
  Loader2,
  MessageSquarePlus,
  PackageCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  useMyDocumentRequests,
  useFulfillDocumentRequest,
  useCancelMyDocumentRequest,
  useAddNoteToDocumentRequest,
} from "@/hooks/use-document-requests";
import { RequestStatusTracker } from "@/components/portal/request-status-tracker";
import type { DocumentRequestItem, DocumentRequestStatus } from "@/types/document";

// ── Status display maps ───────────────────────────────────────────────────────

const STATUS_BADGE: Record<
  DocumentRequestStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Pending", variant: "secondary" },
  in_progress: { label: "In Progress", variant: "default" },
  received: { label: "Received", variant: "default" },
  processing: { label: "Processing", variant: "default" },
  complete: { label: "Complete", variant: "default" },
  cancelled: { label: "Cancelled", variant: "outline" },
  overdue: { label: "Overdue", variant: "destructive" },
};

const STATUS_ICON: Record<DocumentRequestStatus, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-yellow-500" />,
  in_progress: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  received: <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />,
  processing: <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
  complete: <PackageCheck className="h-4 w-4 text-green-700 dark:text-green-300" />,
  cancelled: <XCircle className="h-4 w-4 text-muted-foreground" />,
  overdue: <AlertTriangle className="h-4 w-4 text-destructive" />,
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  passport: "Passport",
  national_id: "National ID",
  proof_of_address: "Proof of Address",
  bank_statement: "Bank Statement",
  tax_return: "Tax Return",
  source_of_wealth: "Source of Wealth",
  financial_statement: "Financial Statement",
  corporate_documents: "Corporate Documents",
  contract: "Contract",
  signed_agreement: "Signed Agreement",
  insurance_certificate: "Insurance Certificate",
  other: "Other",
};

const CATEGORIES = [
  "general",
  "contract",
  "report",
  "correspondence",
  "compliance",
  "financial",
  "legal",
  "other",
] as const;

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatDate(date: string | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ── Upload Dialog ─────────────────────────────────────────────────────────────

function UploadDialog({
  request,
  open,
  onOpenChange,
}: {
  request: DocumentRequestItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fulfill = useFulfillDocumentRequest();
  const [file, setFile] = React.useState<File | null>(null);
  const [category, setCategory] = React.useState("general");
  const [description, setDescription] = React.useState(request.title);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  function handleSubmit() {
    if (!file) return;
    fulfill.mutate(
      { requestId: request.id, file, category, description: description || undefined },
      { onSuccess: () => { onOpenChange(false); setFile(null); } },
    );
  }

  function handleClose(open: boolean) {
    if (!open) {
      setFile(null);
      setCategory("general");
      setDescription(request.title);
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Uploading for: <span className="font-medium text-foreground">{request.title}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File picker */}
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 px-6 py-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <Upload className="h-8 w-8 text-muted-foreground/50 mb-2" />
            {file ? (
              <p className="text-sm font-medium">{file.name}</p>
            ) : (
              <>
                <p className="text-sm font-medium">Click to select a file</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, images, Word, Excel…</p>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
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

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="desc">Description (optional)</Label>
            <Input
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this document"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!file || fulfill.isPending}>
            {fulfill.isPending ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Cancel Confirm Dialog ─────────────────────────────────────────────────────

function CancelDialog({
  request,
  open,
  onOpenChange,
}: {
  request: DocumentRequestItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const cancel = useCancelMyDocumentRequest();

  function handleConfirm() {
    cancel.mutate(request.id, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancel Request</DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel the request for{" "}
            <span className="font-medium text-foreground">{request.title}</span>? This action cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Keep Request</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={cancel.isPending}>
            {cancel.isPending ? "Cancelling…" : "Cancel Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Note Dialog ───────────────────────────────────────────────────────────────

function NoteDialog({
  request,
  open,
  onOpenChange,
}: {
  request: DocumentRequestItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addNote = useAddNoteToDocumentRequest();
  const [note, setNote] = React.useState(request.client_notes ?? "");

  React.useEffect(() => {
    if (open) setNote(request.client_notes ?? "");
  }, [open, request.client_notes]);

  function handleSave() {
    addNote.mutate(
      { requestId: request.id, note },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Note</DialogTitle>
          <DialogDescription>
            Add a note to your request for{" "}
            <span className="font-medium text-foreground">{request.title}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Enter your note here…"
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            This note will be visible to your relationship manager.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!note.trim() || addNote.isPending}>
            {addNote.isPending ? "Saving…" : "Save Note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Request Card ──────────────────────────────────────────────────────────────

function RequestCard({ request }: { request: DocumentRequestItem }) {
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const status = request.status as DocumentRequestStatus;
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.pending;
  const icon = STATUS_ICON[status] ?? STATUS_ICON.pending;
  const canFulfill = status === "pending" || status === "overdue";
  const canCancel = status === "pending" || status === "overdue";
  const isTerminal = status === "cancelled" || status === "complete";

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Header row */}
          <div className="flex items-start gap-4 p-4">
            <div className="mt-0.5">{icon}</div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium leading-tight">{request.title}</h3>
                <Badge variant={badge.variant} className="text-xs">
                  {badge.label}
                </Badge>
                {request.document_type && request.document_type !== "other" && (
                  <Badge variant="outline" className="text-xs">
                    {DOCUMENT_TYPE_LABELS[request.document_type] ?? request.document_type}
                  </Badge>
                )}
              </div>

              {request.message && (
                <p className="text-sm text-muted-foreground leading-relaxed">{request.message}</p>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  Requested{" "}
                  {new Date(request.requested_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                {request.deadline && (
                  <span className="flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" />
                    Due {formatDate(request.deadline)}
                  </span>
                )}
                {request.estimated_completion && !isTerminal && (
                  <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                    <Clock className="h-3 w-3" />
                    Est. completion {formatDate(request.estimated_completion)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {canFulfill && (
                <Button size="sm" onClick={() => setUploadOpen(true)}>
                  <Upload className="h-4 w-4 mr-1" />
                  Upload
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-muted-foreground"
              >
                {expanded ? "Hide" : "Details"}
              </Button>
            </div>
          </div>

          {/* Expanded panel */}
          {expanded && (
            <>
              <Separator />
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Status timeline */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Status Timeline
                  </p>
                  <RequestStatusTracker request={request} />
                </div>

                {/* Notes panel */}
                <div className="space-y-4">
                  {/* RM notes */}
                  {request.rm_notes && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                        Note from AMG
                      </p>
                      <p className="text-sm text-muted-foreground bg-muted/30 rounded-md p-3 leading-relaxed">
                        {request.rm_notes}
                      </p>
                    </div>
                  )}

                  {/* Client notes */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      Your Note
                    </p>
                    {request.client_notes ? (
                      <p className="text-sm text-muted-foreground bg-muted/30 rounded-md p-3 leading-relaxed">
                        {request.client_notes}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No note added yet.</p>
                    )}
                  </div>

                  {/* Actions */}
                  {!isTerminal && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setNoteOpen(true)}
                        className="gap-1.5"
                      >
                        <MessageSquarePlus className="h-3.5 w-3.5" />
                        {request.client_notes ? "Edit Note" : "Add Note"}
                      </Button>
                      {canCancel && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setCancelOpen(true)}
                          className="text-destructive hover:text-destructive gap-1.5"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Cancel Request
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <UploadDialog request={request} open={uploadOpen} onOpenChange={setUploadOpen} />
      <CancelDialog request={request} open={cancelOpen} onOpenChange={setCancelOpen} />
      <NoteDialog request={request} open={noteOpen} onOpenChange={setNoteOpen} />
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "overdue", label: "Overdue" },
  { value: "received", label: "Received" },
  { value: "processing", label: "Processing" },
  { value: "complete", label: "Complete" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export default function DocumentRequestsPage() {
  const { data, isLoading } = useMyDocumentRequests();
  const [filter, setFilter] = React.useState<string>("all");

  const requests = React.useMemo(() => data?.requests ?? [], [data?.requests]);

  const filtered = React.useMemo(() => {
    if (filter === "all") return requests;
    return requests.filter((r) => r.status === filter);
  }, [requests, filter]);

  const actionRequiredCount = requests.filter(
    (r) => r.status === "pending" || r.status === "overdue",
  ).length;

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-serif text-3xl font-bold tracking-tight">Document Requests</h1>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Document Requests</h1>
        <p className="text-sm text-muted-foreground">
          Documents requested by your relationship manager
          {actionRequiredCount > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              {actionRequiredCount} action{actionRequiredCount !== 1 ? "s" : ""} required
            </span>
          )}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.value === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-destructive text-destructive-foreground px-1.5 py-0.5 text-xs leading-none">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Request list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileQuestion className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1">No requests</h3>
            <p className="text-sm text-muted-foreground">
              {filter === "all"
                ? "Your relationship manager hasn't requested any documents yet."
                : `No ${filter.replace("_", " ")} document requests.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => (
            <RequestCard key={req.id} request={req} />
          ))}
        </div>
      )}
    </div>
  );
}
