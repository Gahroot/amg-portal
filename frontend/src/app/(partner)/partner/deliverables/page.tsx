"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyDeliverables } from "@/lib/api/partner-portal";
import { submitDeliverable } from "@/lib/api/deliverables";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

const STATUS_VARIANT: Record<
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

export default function PartnerDeliverablesPage() {
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);
  const [uploadingId, setUploadingId] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["partner-portal", "deliverables"],
    queryFn: () => getMyDeliverables(),
  });

  const submitMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      submitDeliverable(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["partner-portal", "deliverables"],
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
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-serif text-3xl font-bold tracking-tight">
        My Deliverables
      </h1>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Submitted At</TableHead>
              <TableHead>Upload</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.deliverables.map((deliverable) => (
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
                      STATUS_VARIANT[deliverable.status] ?? "outline"
                    }
                  >
                    {deliverable.status.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  {deliverable.due_date
                    ? new Date(deliverable.due_date).toLocaleDateString()
                    : "-"}
                </TableCell>
                <TableCell>
                  {deliverable.submitted_at
                    ? new Date(
                        deliverable.submitted_at
                      ).toLocaleDateString()
                    : "-"}
                </TableCell>
                <TableCell>
                  {(deliverable.status === "pending" ||
                    deliverable.status === "returned") && (
                    <div>
                      <Label htmlFor={`file-${deliverable.id}`} className="sr-only">
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
                        <p className="text-xs text-muted-foreground mt-1">
                          Uploading...
                        </p>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {data?.deliverables.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  No deliverables found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {data && (
        <p className="text-sm text-muted-foreground">
          {data.total} deliverable{data.total !== 1 ? "s" : ""} total
        </p>
      )}
    </div>
  );
}
