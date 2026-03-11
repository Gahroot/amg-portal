"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  usePartnerAssignment,
  useAssignmentDocuments,
  useDownloadDocument,
  useSubmitPartnerDeliverable,
} from "@/hooks/use-partner-portal";
import { listDeliverables } from "@/lib/api/deliverables";
import { acceptAssignment } from "@/lib/api/assignments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  FileText,
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  dispatched: "secondary",
  accepted: "default",
  in_progress: "default",
  completed: "default",
  cancelled: "destructive",
};

const DELIVERABLE_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  submitted: "secondary",
  under_review: "secondary",
  approved: "default",
  returned: "destructive",
  rejected: "destructive",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  submitted: <Upload className="h-4 w-4" />,
  under_review: <AlertCircle className="h-4 w-4" />,
  approved: <CheckCircle2 className="h-4 w-4" />,
  returned: <XCircle className="h-4 w-4" />,
  rejected: <XCircle className="h-4 w-4" />,
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function PartnerAssignmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.id as string;
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);
  const [uploadingId, setUploadingId] = React.useState<string | null>(null);

  const { data: assignment, isLoading } = usePartnerAssignment(assignmentId);
  const { data: documentsData } = useAssignmentDocuments(assignmentId);
  const downloadMutation = useDownloadDocument();
  const submitMutation = useSubmitPartnerDeliverable();

  const { data: deliverablesData } = useQuery({
    queryKey: ["deliverables", { assignment_id: assignmentId }],
    queryFn: () => listDeliverables({ assignment_id: assignmentId }),
    enabled: !!assignmentId,
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptAssignment(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["partner-portal", "assignments", assignmentId],
      });
    },
    onError: () => {
      setError("Failed to accept assignment.");
    },
  });

  const handleFileUpload = (deliverableId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingId(deliverableId);
      submitMutation.mutate(
        { id: deliverableId, file },
        {
          onSuccess: () => setUploadingId(null),
          onError: () => setUploadingId(null),
        }
      );
    }
  };

  const handleDownload = (documentId: string) => {
    downloadMutation.mutate(documentId);
  };

  const getDueDateDisplay = (dateStr: string | null) => {
    if (!dateStr) return { text: "Not set", color: "text-muted-foreground" };
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { text: `Overdue by ${Math.abs(diffDays)} days`, color: "text-destructive" };
    if (diffDays === 0) return { text: "Due today", color: "text-orange-600" };
    if (diffDays === 1) return { text: "Due tomorrow", color: "text-orange-600" };
    if (diffDays <= 7) return { text: `Due in ${diffDays} days`, color: "text-yellow-600" };
    return { text: date.toLocaleDateString(), color: "text-muted-foreground" };
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="text-muted-foreground text-sm">Loading assignment...</p>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="text-muted-foreground">Assignment not found.</p>
      </div>
    );
  }

  const dueDate = getDueDateDisplay(assignment.due_date);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="mb-2" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Inbox
          </Button>
          <h1 className="font-serif text-3xl font-bold tracking-tight">{assignment.title}</h1>
          <div className="flex items-center gap-3">
            <Badge variant={STATUS_VARIANT[assignment.status] ?? "outline"}>
              {assignment.status.replace(/_/g, " ")}
            </Badge>
            {assignment.program_title && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <FileText className="h-4 w-4" />
                {assignment.program_title}
              </span>
            )}
          </div>
        </div>
        {assignment.status === "dispatched" && (
          <Button onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending} size="lg">
            {acceptMutation.isPending ? "Accepting..." : "Accept Assignment"}
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Key Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <p className="text-sm">Due Date</p>
            </div>
            <p className={`font-medium ${dueDate.color}`}>{dueDate.text}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <p className="text-sm">Created</p>
            </div>
            <p className="font-medium">{new Date(assignment.created_at).toLocaleDateString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FileText className="h-4 w-4" />
              <p className="text-sm">Deliverables</p>
            </div>
            <p className="font-medium">{deliverablesData?.deliverables.length ?? 0} items</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Brief, Documents, and Deliverables */}
      <Tabs defaultValue="brief" className="space-y-4">
        <TabsList>
          <TabsTrigger value="brief">Brief & Requirements</TabsTrigger>
          <TabsTrigger value="documents">
            Documents
            {documentsData?.documents && documentsData.documents.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {documentsData.documents.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
        </TabsList>

        {/* Brief Tab */}
        <TabsContent value="brief" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assignment Brief</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{assignment.brief}</p>
            </CardContent>
          </Card>

          {assignment.sla_terms && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">SLA Terms & Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{assignment.sla_terms}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Brief Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {!documentsData?.documents || documentsData.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No documents attached to this assignment.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentsData.documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            {doc.file_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{doc.category}</Badge>
                        </TableCell>
                        <TableCell>{formatBytes(doc.file_size)}</TableCell>
                        <TableCell>{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc.id)}
                            disabled={downloadMutation.isPending}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deliverables Tab */}
        <TabsContent value="deliverables">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Deliverables</CardTitle>
            </CardHeader>
            <CardContent>
              {!deliverablesData?.deliverables || deliverablesData.deliverables.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No deliverables defined for this assignment.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Upload</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliverablesData.deliverables.map((deliverable) => (
                      <TableRow key={deliverable.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{deliverable.title}</p>
                            {deliverable.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {deliverable.description}
                              </p>
                            )}
                            {deliverable.review_comments && (
                              <p className="text-xs text-orange-600">
                                Review: {deliverable.review_comments}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{deliverable.deliverable_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {STATUS_ICONS[deliverable.status]}
                            <Badge variant={DELIVERABLE_STATUS_VARIANT[deliverable.status] ?? "outline"}>
                              {deliverable.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {deliverable.due_date
                            ? new Date(deliverable.due_date).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {(deliverable.status === "pending" || deliverable.status === "returned") && (
                            <div>
                              <Label htmlFor={`file-${deliverable.id}`} className="sr-only">
                                Upload file
                              </Label>
                              <Input
                                id={`file-${deliverable.id}`}
                                type="file"
                                className="w-[200px]"
                                onChange={(e) => handleFileUpload(deliverable.id, e)}
                                disabled={uploadingId === deliverable.id}
                              />
                              {uploadingId === deliverable.id && (
                                <p className="text-xs text-muted-foreground mt-1">Uploading...</p>
                              )}
                            </div>
                          )}
                          {deliverable.status === "submitted" && (
                            <span className="text-xs text-muted-foreground">Submitted for review</span>
                          )}
                          {deliverable.status === "approved" && (
                            <span className="text-xs text-green-600">Approved</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
