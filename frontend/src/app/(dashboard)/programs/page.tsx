"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { listPrograms } from "@/lib/api/programs";
import type { ProgramStatus } from "@/lib/api/programs";
import { Button } from "@/components/ui/button";
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
import { StatusBadge } from "@/components/programs/status-badge";
import { RagBadge } from "@/components/programs/rag-badge";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "intake", label: "Intake" },
  { value: "design", label: "Design" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
];

export default function ProgramsPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = React.useState("all");

  const isInternal =
    user?.role !== "client" && user?.role !== "partner";

  const { data, isLoading } = useQuery({
    queryKey: ["programs", statusFilter],
    queryFn: () =>
      listPrograms(
        statusFilter !== "all"
          ? { status: statusFilter as ProgramStatus }
          : undefined
      ),
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
            Programs
          </h1>
          <Button asChild>
            <Link href="/programs/new">New Program</Link>
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading programs...</p>
        ) : (
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>RAG</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.programs.map((program) => (
                  <TableRow key={program.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/programs/${program.id}`}
                        className="hover:underline"
                      >
                        {program.title}
                      </Link>
                    </TableCell>
                    <TableCell>{program.client_name}</TableCell>
                    <TableCell>
                      <StatusBadge status={program.status} />
                    </TableCell>
                    <TableCell>
                      <RagBadge status={program.rag_status} />
                    </TableCell>
                    <TableCell>
                      {program.start_date
                        ? new Date(program.start_date).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {program.end_date
                        ? new Date(program.end_date).toLocaleDateString()
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {data?.programs.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No programs found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {data && (
          <p className="text-sm text-muted-foreground">
            {data.total} program{data.total !== 1 ? "s" : ""} total
          </p>
        )}
      </div>
    </div>
  );
}
