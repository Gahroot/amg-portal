"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyAssignment } from "@/lib/api/partner-portal";
import {
  listDeliverables,
  submitDeliverable,
} from "@/lib/api/deliverables";
import {
  AssignmentActions,
  AssignmentStatusBadge,
} from "@/components/partner/assignment-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

export default function PartnerAssignmentDetailPage() {
  const params = useParams();
  const assignmentId = params.id as string;
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);
  const [uploadingId, setUploadingId] = React.useState<string | null>(null);

  const { data: assignment, isLoading } = useQuery({
    queryKey: ["partner-portal", "assignments", assignmentId],
    queryFn: () => getMyAssignment(assignmentId),
  });

  const { data: deliverablesData } = useQuery({
    queryKey: ["deliverables", { assignment_id: assignmentId }],
    queryFn: () => listDeliverables({ assignment_id: assignmentId }),
    enabled: !!assignmentId,
  });

  const submitMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      submitDeliverable(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["deliverables", { assignment_id: assignmentId }],
      });
      setUploadingId(null);
    },
    onError: () => {
      setError("Failed to submit deliverable.");
      setUploadingId(null);
    },
  });

  const handleFileUpload = (
    deliverableId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingId(deliverableId);
      submitMutation.mutate({ id: deliverableId, file });
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-muted-foreground">Assignment not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          {assignment.title}
        </h1>
        <AssignmentStatusBadge status={assignment.status} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Accept / Decline actions + deadline + history */}
      <AssignmentActions
        assignment={assignment}
        onStatusChange={() =>
          queryClient.invalidateQueries({
            queryKey: ["partner-portal", "assignments", assignmentId],
          })
        }
      />

      {/* Meta cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-sm">Program</p>
            <p className="font-medium">{assignment.program_title ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-sm">Due Date</p>
            <p className="font-medium">
              {assignment.due_date
                ? new Date(assignment.due_date).toLocaleDateString()
                : "Not set"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Brief */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-muted-foreground text-sm">Brief</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{assignment.brief}</p>
        </CardContent>
      </Card>

      {/* SLA Terms */}
      {assignment.sla_terms && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-sm">SLA Terms</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {assignment.sla_terms}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Deliverables */}
      <div className="space-y-4">
        <h2 className="font-serif text-xl font-semibold">Deliverables</h2>

        <div className="rounded-md border bg-card">
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
              {deliverablesData?.deliverables.map((deliverable) => (
                <TableRow key={deliverable.id}>
                  <TableCell className="font-medium">
                    {deliverable.title}
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
                      ? new Date(deliverable.due_date).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {(deliverable.status === "pending" ||
                      deliverable.status === "returned") && (
                      <div>
                        <Label
                          htmlFor={`file-${deliverable.id}`}
                          className="sr-only"
                        >
                          Upload file
                        </Label>
                        <Input
                          id={`file-${deliverable.id}`}
                          type="file"
                          className="w-[200px]"
                          onChange={(e) =>
                            handleFileUpload(deliverable.id, e)
                          }
                          disabled={uploadingId === deliverable.id}
                        />
                        {uploadingId === deliverable.id && (
                          <p className="text-muted-foreground mt-1 text-xs">
                            Uploading…
                          </p>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!deliverablesData ||
                deliverablesData.deliverables.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground text-center"
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
  );
}
