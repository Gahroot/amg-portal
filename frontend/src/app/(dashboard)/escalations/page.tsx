"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import {
  listEscalations,
  exportEscalationsCsv,
  acknowledgeEscalation,
} from "@/lib/api/escalations";
import type { EscalationListParams } from "@/lib/api/escalations";
import { useResolveEscalation } from "@/hooks/use-escalations";
import { EscalationStatusBadge } from "@/components/escalations/status-badge";
import { EscalationLevelBadge } from "@/components/escalations/level-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";

const ALLOWED_ROLES = [
  "coordinator",
  "relationship_manager",
  "managing_director",
  "finance_compliance",
];

const ESCALATION_LEVELS = [
  { value: "task", label: "Task" },
  { value: "milestone", label: "Milestone" },
  { value: "program", label: "Program" },
  { value: "client_impact", label: "Client Impact" },
];

const ESCALATION_STATUSES = [
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "investigating", label: "Investigating" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PAGE_SIZE = 50;

export default function EscalationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [filters, setFilters] = React.useState<EscalationListParams>({});
  const [page, setPage] = React.useState(0);
  const queryClient = useQueryClient();

  const queryParams = { ...filters, skip: page * PAGE_SIZE, limit: PAGE_SIZE };

  const { data, isLoading } = useQuery({
    queryKey: ["escalations", queryParams],
    queryFn: () => listEscalations(queryParams),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  const resolveMutation = useResolveEscalation();
  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => acknowledgeEscalation(id),
    onSuccess: () => {
      toast.success("Escalation acknowledged");
      queryClient.invalidateQueries({ queryKey: ["escalations"] });
    },
    onError: () => toast.error("Failed to acknowledge escalation"),
  });

  const handleExport = async () => {
    try {
      const blob = await exportEscalationsCsv(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "escalations.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Escalations exported successfully");
    } catch {
      toast.error("Failed to export escalations");
    }
  };

  const handleResolve = (id: string, title: string) => {
    const notes = prompt(`Add resolution notes for "${title}":`);
    if (notes !== null) {
      resolveMutation.mutate(
        { id, notes },
        {
          onSuccess: () => toast.success("Escalation resolved"),
          onError: () => toast.error("Failed to resolve escalation"),
        },
      );
    }
  };

  const handleAcknowledge = (id: string) => {
    acknowledgeMutation.mutate(id);
  };

  const getAgeInDays = (dateString: string) => {
    const now = new Date();
    const then = new Date(dateString);
    const diff = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Today";
    if (diff === 1) return "1d";
    return `${diff}d`;
  };

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Escalations
          </h1>
          <Button onClick={handleExport} variant="outline">
            Export CSV
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Select
            onValueChange={(value) => {
              setPage(0);
              setFilters((f) => ({
                ...f,
                level: value === "all" ? undefined : value,
              }));
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {ESCALATION_LEVELS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            onValueChange={(value) => {
              setPage(0);
              setFilters((f) => ({
                ...f,
                status: value === "all" ? undefined : value,
              }));
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {ESCALATION_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Search by title..."
            className="max-w-xs"
            readOnly
          />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading escalations...</p>
        ) : (
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Level</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.escalations.map((esc) => (
                  <TableRow
                    key={esc.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/escalations/${esc.id}`)}
                  >
                    <TableCell>
                      <EscalationLevelBadge level={esc.level} />
                    </TableCell>
                    <TableCell className="font-medium">{esc.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {esc.entity_type}:{esc.entity_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="text-sm">
                      {esc.owner_name || esc.owner_email || "Unknown"}
                    </TableCell>
                    <TableCell>
                      <EscalationStatusBadge status={esc.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getAgeInDays(esc.triggered_at)}
                    </TableCell>
                    <TableCell
                      onClick={(e) => e.stopPropagation()}
                      className="flex gap-2"
                    >
                      {esc.status === "open" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcknowledge(esc.id);
                          }}
                          disabled={acknowledgeMutation.isPending}
                        >
                          Acknowledge
                        </Button>
                      )}
                      {esc.status !== "resolved" && esc.status !== "closed" && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolve(esc.id, esc.title);
                          }}
                          disabled={resolveMutation.isPending}
                        >
                          Resolve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {data?.escalations.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground"
                    >
                      No escalations found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} escalation{data?.total !== 1 ? "s" : ""} total
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
