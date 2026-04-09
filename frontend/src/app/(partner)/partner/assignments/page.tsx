"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyAssignments } from "@/lib/api/partner-portal";
import { acceptAssignment } from "@/lib/api/assignments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  draft: "outline",
  dispatched: "secondary",
  accepted: "default",
  in_progress: "default",
  completed: "default",
  cancelled: "destructive",
};

export default function PartnerAssignmentsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["partner-portal", "assignments"],
    queryFn: () => getMyAssignments(),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => acceptAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["partner-portal", "assignments"],
      });
    },
    onError: () => {
      setError("Failed to accept assignment.");
    },
  });

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
        My Assignments
      </h1>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.assignments.map((assignment) => (
              <TableRow key={assignment.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/partner/assignments/${assignment.id}`}
                    className="hover:underline"
                  >
                    {assignment.title}
                  </Link>
                </TableCell>
                <TableCell>{assignment.program_title ?? "-"}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      STATUS_VARIANT[assignment.status] ?? "outline"
                    }
                  >
                    {assignment.status.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  {assignment.due_date
                    ? new Date(assignment.due_date).toLocaleDateString()
                    : "-"}
                </TableCell>
                <TableCell>
                  {assignment.status === "dispatched" && (
                    <Button
                      size="sm"
                      onClick={() => acceptMutation.mutate(assignment.id)}
                      disabled={acceptMutation.isPending}
                    >
                      {acceptMutation.isPending ? "Accepting..." : "Accept"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {data?.assignments.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  No assignments found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {data && (
        <p className="text-sm text-muted-foreground">
          {data.total} assignment{data.total !== 1 ? "s" : ""} total
        </p>
      )}
    </div>
  );
}
