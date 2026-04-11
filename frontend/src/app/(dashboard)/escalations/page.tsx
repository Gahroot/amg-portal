"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import {
  listEscalations,
  acknowledgeEscalation,
} from "@/lib/api/escalations";
import type { EscalationListParams } from "@/lib/api/escalations";
import type { Escalation } from "@/types/escalation";
import { useResolveEscalation, useOverdueEscalations } from "@/hooks/use-escalations";
import { useDebounce } from "@/hooks/use-debounce";
import { EscalationStatusBadge } from "@/components/escalations/status-badge";
import { EscalationLevelBadge } from "@/components/escalations/level-badge";
import { EscalationCreateDialog } from "@/components/escalations/escalation-create-dialog";
import { Balancer } from "react-wrap-balancer";
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
import { BarChart2, LayoutTemplate, Plus, Search } from "lucide-react";
import Link from "next/link";
import { EscalationRuleList } from "@/components/escalations/escalation-rule-list";
import { EscalationRuleForm } from "@/components/escalations/escalation-rule-form";
import { EscalationMetrics } from "@/components/escalations/escalation-metrics";
import type { EscalationRule } from "@/types/escalation-rule";
import { DataTableExport } from "@/components/ui/data-table-export";
import type { ExportColumn } from "@/lib/export-utils";
import { API_BASE_URL } from "@/lib/constants";

const EXPORT_COLUMNS: ExportColumn<Escalation>[] = [
  { header: "Title", accessor: "title" },
  { header: "Level", accessor: "level" },
  { header: "Status", accessor: "status" },
  { header: "Entity Type", accessor: "entity_type" },
  { header: "Owner", accessor: (r) => r.owner_name ?? r.owner_email ?? "" },
  { header: "Triggered By", accessor: (r) => r.triggered_by_name ?? r.triggered_by_email ?? "" },
  { header: "Triggered At", accessor: (r) => new Date(r.triggered_at).toLocaleDateString() },
  { header: "Resolved At", accessor: (r) => r.resolved_at ? new Date(r.resolved_at).toLocaleDateString() : "" },
  { header: "Resolution Notes", accessor: (r) => r.resolution_notes ?? "" },
];

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
  { value: "overdue", label: "Overdue" },
];

const PAGE_SIZE = 50;

function EscalationsPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") ?? ""
  );
  const debouncedSearch = useDebounce(searchInput, 300);

  const levelParam = searchParams.get("level") ?? "all";
  const statusParam = searchParams.get("status") ?? "all";
  const [page, setPage] = useState(0);
  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<EscalationRule | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const updateParam = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace(`${pathname}?${params.toString()}`);
      setPage(0);
    },
    [pathname, router, searchParams, setPage]
  );

  useEffect(() => {
    updateParam("search", debouncedSearch || undefined);
  }, [debouncedSearch, updateParam]);

  const isOverdueFilter = statusParam === "overdue";

  const queryParams: EscalationListParams = {
    level: levelParam !== "all" ? levelParam : undefined,
    status: !isOverdueFilter && statusParam !== "all" ? statusParam : undefined,
    search: debouncedSearch || undefined,
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  };

  const { data: regularData, isLoading: regularLoading } = useQuery({
    queryKey: ["escalations", queryParams],
    queryFn: () => listEscalations(queryParams),
    enabled: !!user && ALLOWED_ROLES.includes(user.role) && !isOverdueFilter,
  });

  const { data: overdueData, isLoading: overdueLoading } = useOverdueEscalations(
    isOverdueFilter ? { skip: page * PAGE_SIZE, limit: PAGE_SIZE } : undefined,
  );

  const data = isOverdueFilter ? overdueData : regularData;
  const isLoading = isOverdueFilter ? overdueLoading : regularLoading;

  const resolveMutation = useResolveEscalation();
  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => acknowledgeEscalation(id),
    onSuccess: () => {
      toast.success("Escalation acknowledged");
      queryClient.invalidateQueries({ queryKey: ["escalations"] });
    },
    onError: () => toast.error("Failed to acknowledge escalation"),
  });

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
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Metrics Cards */}
        <EscalationMetrics />

        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            <Balancer>Escalations</Balancer>
          </h1>
          <div className="flex items-center gap-2">
            <Link href="/escalations/metrics">
              <Button variant="outline" size="sm" className="gap-2">
                <BarChart2 className="h-4 w-4" />
                Metrics
              </Button>
            </Link>
            <Link href="/escalations/templates">
              <Button variant="outline" size="sm" className="gap-2">
                <LayoutTemplate className="h-4 w-4" />
                Templates
              </Button>
            </Link>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              New Escalation
            </Button>
            <DataTableExport
              visibleRows={data?.escalations ?? []}
              columns={EXPORT_COLUMNS}
              fileName="escalations"
              exportAllUrl={(() => {
                const params = new URLSearchParams();
                if (statusParam !== "all") params.set("status", statusParam);
                if (levelParam !== "all") params.set("level", levelParam);
                if (debouncedSearch) params.set("search", debouncedSearch);
                const qs = params.toString();
                return `${API_BASE_URL}/api/v1/export/escalations${qs ? `?${qs}` : ""}`;
              })()}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Select
            value={levelParam}
            onValueChange={(value) => updateParam("level", value)}
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
            value={statusParam}
            onValueChange={(value) => updateParam("status", value)}
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
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading escalations...</p>
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Level</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.escalations.map((esc) => (
                  <TableRow
                    key={esc.id}
                    className={`cursor-pointer ${esc.is_overdue ? "bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/30" : ""}`}
                    onClick={() => router.push(`/escalations/${esc.id}`)}
                  >
                    <TableCell>
                      <EscalationLevelBadge level={esc.level} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {esc.title}
                      {esc.is_overdue && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
                          Overdue
                        </span>
                      )}
                    </TableCell>
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
                      {esc.response_deadline
                        ? new Date(esc.response_deadline).toLocaleString()
                        : "—"}
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
                      colSpan={8}
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

        {/* Auto-Trigger Rules section */}
        <div className="mt-8 border-t pt-8">
          <EscalationRuleList
            onEdit={(rule) => {
              setEditingRule(rule);
              setRuleFormOpen(true);
            }}
            onCreate={() => {
              setEditingRule(null);
              setRuleFormOpen(true);
            }}
          />
        </div>

        <EscalationRuleForm
          open={ruleFormOpen}
          onOpenChange={setRuleFormOpen}
          editingRule={editingRule}
        />

        <EscalationCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      </div>
    </div>
  );
}

export default function EscalationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading...</div>}>
      <EscalationsPageContent />
    </Suspense>
  );
}
