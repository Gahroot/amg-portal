"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { listDeliverables } from "@/lib/api/deliverables";
import type { DeliverableListParams } from "@/lib/api/deliverables";
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
  pending: "outline",
  submitted: "secondary",
  under_review: "secondary",
  approved: "default",
  returned: "destructive",
  rejected: "destructive",
};

export default function DeliverablesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [filters, setFilters] = React.useState<DeliverableListParams>({});

  const isInternal = user?.role !== "client" && user?.role !== "partner";

  const { data, isLoading } = useQuery({
    queryKey: ["deliverables", filters],
    queryFn: () => listDeliverables(filters),
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
            Deliverables
          </h1>
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
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">
            Loading deliverables...
          </p>
        ) : (
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
                {data?.deliverables.map((deliverable) => (
                  <TableRow
                    key={deliverable.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/deliverables/${deliverable.id}`)
                    }
                  >
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
                {data?.deliverables.length === 0 && (
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
        )}

        {data && (
          <p className="text-sm text-muted-foreground">
            {data.total} deliverable{data.total !== 1 ? "s" : ""} total
          </p>
        )}
      </div>
    </div>
  );
}
