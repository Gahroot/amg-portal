"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { listAssignments } from "@/lib/api/assignments";
import type { AssignmentListParams } from "@/lib/api/assignments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

export default function AssignmentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [filters, setFilters] = React.useState<AssignmentListParams>({});

  const isInternal = user?.role !== "client" && user?.role !== "partner";

  const { data, isLoading } = useQuery({
    queryKey: ["assignments", filters],
    queryFn: () => listAssignments(filters),
    enabled: isInternal,
  });

  if (!isInternal) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Assignments
          </h1>
          <Button asChild>
            <Link href="/assignments/new">New Assignment</Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Select
            onValueChange={(value) =>
              setFilters((f) => ({
                ...f,
                status: value === "all" ? undefined : value,
              }))
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="dispatched">Dispatched</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">
            Loading assignments...
          </p>
        ) : (
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.assignments.map((assignment) => (
                  <TableRow
                    key={assignment.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/assignments/${assignment.id}`)
                    }
                  >
                    <TableCell className="font-medium">
                      {assignment.title}
                    </TableCell>
                    <TableCell>
                      {assignment.partner_firm_name ?? "-"}
                    </TableCell>
                    <TableCell>
                      {assignment.program_title ?? "-"}
                    </TableCell>
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
                        ? new Date(
                            assignment.due_date
                          ).toLocaleDateString()
                        : "-"}
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
        )}

        {data && (
          <p className="text-sm text-muted-foreground">
            {data.total} assignment{data.total !== 1 ? "s" : ""} total
          </p>
        )}
      </div>
    </div>
  );
}
