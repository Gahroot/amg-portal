"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAssignment,
  dispatchAssignment,
} from "@/lib/api/assignments";
import { getPartner } from "@/lib/api/partners";
import {
  listDeliverables,
  createDeliverable,
  uploadDeliverableFile,
  attachDocumentToDeliverable,
} from "@/lib/api/deliverables";
import { listDocuments } from "@/lib/api/documents";
import type { DeliverableCreateData } from "@/types/deliverable";
import { FileUploadZone } from "@/components/documents/file-upload-zone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Check, ShieldAlert } from "lucide-react";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  dispatched: "secondary",
  accepted: "default",
  in_progress: "default",
  completed: "default",
  cancelled: "destructive",
};

const DELIVERABLE_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  submitted: "secondary",
  under_review: "secondary",
  approved: "default",
  returned: "destructive",
  rejected: "destructive",
};

type DocMode = "none" | "upload" | "library";

export default function AssignmentDetailPage() {
  const params = useParams();
  const assignmentId = params.id as string;
  const queryClient = useQueryClient();

  const [deliverableOpen, setDeliverableOpen] = React.useState(false);
  const [newDeliverable, setNewDeliverable] = React.useState({
    title: "",
    deliverable_type: "document",
    description: "",
    due_date: "",
  });
  const [docMode, setDocMode] = React.useState<DocMode>("none");
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [selectedDocId, setSelectedDocId] = React.useState<string | null>(null);
  const [docSearch, setDocSearch] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const { data: assignment, isLoading } = useQuery({
    queryKey: ["assignments", assignmentId],
    queryFn: () => getAssignment(assignmentId),
  });

  const { data: deliverablesData } = useQuery({
    queryKey: ["deliverables", { assignment_id: assignmentId }],
    queryFn: () => listDeliverables({ assignment_id: assignmentId }),
    enabled: !!assignmentId,
  });

  const { data: assignedPartner } = useQuery({
    queryKey: ["partners", assignment?.partner_id],
    queryFn: () => getPartner(assignment!.partner_id),
    enabled: !!assignment?.partner_id,
  });

  const { data: allDocs } = useQuery({
    queryKey: ["documents", "all"],
    queryFn: () => listDocuments({ limit: 200 }),
    enabled: deliverableOpen && docMode === "library",
  });

  function resetDocState() {
    setDocMode("none");
    setUploadFile(null);
    setSelectedDocId(null);
    setDocSearch("");
  }

  function handleDialogOpenChange(open: boolean) {
    setDeliverableOpen(open);
    if (!open) {
      resetDocState();
      setNewDeliverable({
        title: "",
        deliverable_type: "document",
        description: "",
        due_date: "",
      });
      setError(null);
    }
  }

  const dispatchMutation = useMutation({
    mutationFn: () => dispatchAssignment(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["assignments", assignmentId],
      });
    },
    onError: () => {
      setError("Failed to dispatch assignment.");
    },
  });

  const createDeliverableMutation = useMutation({
    mutationFn: async (data: DeliverableCreateData) => {
      const deliverable = await createDeliverable(data);
      if (docMode === "upload" && uploadFile) {
        return uploadDeliverableFile(deliverable.id, uploadFile);
      }
      if (docMode === "library" && selectedDocId) {
        return attachDocumentToDeliverable(deliverable.id, selectedDocId);
      }
      return deliverable;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["deliverables", { assignment_id: assignmentId }],
      });
      handleDialogOpenChange(false);
    },
    onError: () => {
      setError("Failed to create deliverable.");
    },
  });

  const filteredDocs = React.useMemo(() => {
    const docs = allDocs?.documents ?? [];
    if (!docSearch.trim()) return docs;
    const lower = docSearch.toLowerCase();
    return docs.filter(
      (d) =>
        d.file_name.toLowerCase().includes(lower) ||
        (d.description ?? "").toLowerCase().includes(lower),
    );
  }, [allDocs, docSearch]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground text-sm">
            Loading assignment...
          </p>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground">Assignment not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            {assignment.title}
          </h1>
          <div className="flex items-center gap-2">
            <Badge
              variant={STATUS_VARIANT[assignment.status] ?? "outline"}
            >
              {assignment.status.replace(/_/g, " ")}
            </Badge>
            {assignment.status === "draft" && (
              <Button
                onClick={() => dispatchMutation.mutate()}
                disabled={dispatchMutation.isPending}
              >
                {dispatchMutation.isPending ? "Dispatching..." : "Dispatch"}
              </Button>
            )}
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {assignedPartner?.is_on_probation && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-900">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-900">Enhanced Oversight Required</AlertTitle>
            <AlertDescription className="text-amber-800">
              <span className="font-semibold">{assignedPartner.firm_name}</span> is a probationary
              partner ({assignedPartner.completed_assignments} of 3 qualifying engagements
              completed). Apply additional review steps to all deliverables, communications, and
              sign-offs on this assignment.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Partner</p>
              <p className="font-medium">
                {assignment.partner_firm_name ?? "-"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Program</p>
              <p className="font-medium">
                {assignment.program_title ?? "-"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Due Date</p>
              <p className="font-medium">
                {assignment.due_date
                  ? new Date(assignment.due_date).toLocaleDateString()
                  : "Not set"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge
                variant={STATUS_VARIANT[assignment.status] ?? "outline"}
              >
                {assignment.status.replace(/_/g, " ")}
              </Badge>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Brief</p>
            <p className="text-sm mt-1 whitespace-pre-wrap">
              {assignment.brief}
            </p>
          </CardContent>
        </Card>

        {assignment.sla_terms && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">SLA Terms</p>
              <p className="text-sm mt-1 whitespace-pre-wrap">
                {assignment.sla_terms}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold">Deliverables</h2>
            <Dialog
              open={deliverableOpen}
              onOpenChange={handleDialogOpenChange}
            >
              <DialogTrigger asChild>
                <Button>Add Deliverable</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Deliverable</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={newDeliverable.title}
                      onChange={(e) =>
                        setNewDeliverable((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={newDeliverable.deliverable_type}
                      onValueChange={(value) =>
                        setNewDeliverable((prev) => ({
                          ...prev,
                          deliverable_type: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="document">Document</SelectItem>
                        <SelectItem value="report">Report</SelectItem>
                        <SelectItem value="presentation">
                          Presentation
                        </SelectItem>
                        <SelectItem value="spreadsheet">
                          Spreadsheet
                        </SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={newDeliverable.description}
                      onChange={(e) =>
                        setNewDeliverable((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={newDeliverable.due_date}
                      onChange={(e) =>
                        setNewDeliverable((prev) => ({
                          ...prev,
                          due_date: e.target.value,
                        }))
                      }
                    />
                  </div>

                  {/* Document attachment section */}
                  <div className="space-y-2">
                    <Label>Document (optional)</Label>
                    <div className="flex gap-2">
                      {(["none", "upload", "library"] as DocMode[]).map((mode) => (
                        <Button
                          key={mode}
                          type="button"
                          variant={docMode === mode ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setDocMode(mode);
                            setUploadFile(null);
                            setSelectedDocId(null);
                            setDocSearch("");
                          }}
                        >
                          {mode === "none" && "None"}
                          {mode === "upload" && "Upload New"}
                          {mode === "library" && "From Library"}
                        </Button>
                      ))}
                    </div>

                    {docMode === "upload" && (
                      <FileUploadZone onFileSelect={setUploadFile} />
                    )}

                    {docMode === "library" && (
                      <div className="space-y-2">
                        <Input
                          placeholder="Search documents..."
                          value={docSearch}
                          onChange={(e) => setDocSearch(e.target.value)}
                        />
                        <div className="max-h-48 overflow-y-auto rounded-md border">
                          {filteredDocs.length === 0 ? (
                            <p className="p-3 text-sm text-muted-foreground">
                              {allDocs ? "No documents found." : "Loading…"}
                            </p>
                          ) : (
                            filteredDocs.map((doc) => (
                              <button
                                key={doc.id}
                                type="button"
                                onClick={() => setSelectedDocId(doc.id)}
                                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 ${
                                  selectedDocId === doc.id ? "bg-muted" : ""
                                }`}
                              >
                                <span className="truncate font-medium">
                                  {doc.file_name}
                                </span>
                                <span className="ml-2 flex shrink-0 items-center gap-1 text-muted-foreground">
                                  {selectedDocId === doc.id && (
                                    <Check className="size-4 text-primary" />
                                  )}
                                  <span className="text-xs">
                                    {(doc.file_size / 1024).toFixed(0)} KB
                                  </span>
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() =>
                      createDeliverableMutation.mutate({
                        assignment_id: assignmentId,
                        title: newDeliverable.title,
                        deliverable_type:
                          newDeliverable.deliverable_type || undefined,
                        description:
                          newDeliverable.description || undefined,
                        due_date: newDeliverable.due_date || undefined,
                      })
                    }
                    disabled={
                      !newDeliverable.title ||
                      createDeliverableMutation.isPending ||
                      (docMode === "upload" && !uploadFile) ||
                      (docMode === "library" && !selectedDocId)
                    }
                  >
                    {createDeliverableMutation.isPending
                      ? "Adding..."
                      : "Add"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Client Visible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliverablesData?.deliverables.map((deliverable) => (
                  <TableRow key={deliverable.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/deliverables/${deliverable.id}`}
                        className="hover:underline"
                      >
                        {deliverable.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {deliverable.deliverable_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          DELIVERABLE_STATUS_VARIANT[deliverable.status] ??
                          "outline"
                        }
                      >
                        {deliverable.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {deliverable.due_date
                        ? new Date(
                            deliverable.due_date
                          ).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {deliverable.client_visible ? "Yes" : "No"}
                    </TableCell>
                  </TableRow>
                ))}
                {(!deliverablesData ||
                  deliverablesData.deliverables.length === 0) && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      No deliverables found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
