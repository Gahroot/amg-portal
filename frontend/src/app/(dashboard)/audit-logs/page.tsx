"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import {
  listAuditLogs,
  exportAuditLogsCsv,
} from "@/lib/api/audit-logs";
import type { AuditLogListParams } from "@/lib/api/audit-logs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const ALLOWED_ROLES = ["finance_compliance", "managing_director"];

const ACTION_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  create: "default",
  update: "secondary",
  delete: "destructive",
};

const ENTITY_TYPES = [
  "api_key",
  "api_key_usage",
  "approval",
  "break_glass_requests",
  "budget_approval_request",
  "budget_approval_step",
  "client",
  "client_profile",
  "communication",
  "communication_log",
  "consent_log",
  "conversation",
  "deliverable",
  "document",
  "document_request",
  "documents",
  "erasure_requests",
  "kyc_document",
  "meeting",
  "milestone",
  "partner_profile",
  "program",
  "program_approval",
  "report_schedule",
  "scheduled_event",
  "security_brief",
  "security_profile_level",
  "task",
  "task_bulk",
  "user",
  "users",
  "webauthn_credentials",
];

const PAGE_SIZE = 50;

export default function AuditLogsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [filters, setFilters] = useState<AuditLogListParams>({});
  const [page, setPage] = useState(0);

  const queryParams = { ...filters, skip: page * PAGE_SIZE, limit: PAGE_SIZE };

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", queryParams],
    queryFn: () => listAuditLogs(queryParams),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  const handleExport = async () => {
    const blob = await exportAuditLogsCsv(filters);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit_logs.csv";
    a.click();
    URL.revokeObjectURL(url);
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
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Audit Log
          </h1>
          <Button onClick={handleExport} variant="outline">
            Export CSV
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Input
            placeholder="Search by email, entity..."
            className="max-w-xs"
            onChange={(e) => {
              setPage(0);
              setFilters((f) => ({
                ...f,
                search: e.target.value || undefined,
              }));
            }}
          />
          <Select
            onValueChange={(value) => {
              setPage(0);
              setFilters((f) => ({
                ...f,
                action: value === "all" ? undefined : value,
              }));
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
            </SelectContent>
          </Select>
          <Select
            onValueChange={(value) => {
              setPage(0);
              setFilters((f) => ({
                ...f,
                entity_type: value === "all" ? undefined : value,
              }));
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Entity Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {ENTITY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            className="w-[160px]"
            placeholder="Start date"
            onChange={(e) => {
              setPage(0);
              setFilters((f) => ({
                ...f,
                start_date: e.target.value
                  ? `${e.target.value}T00:00:00Z`
                  : undefined,
              }));
            }}
          />
          <Input
            type="date"
            className="w-[160px]"
            placeholder="End date"
            onChange={(e) => {
              setPage(0);
              setFilters((f) => ({
                ...f,
                end_date: e.target.value
                  ? `${e.target.value}T23:59:59Z`
                  : undefined,
              }));
            }}
          />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading audit logs...</p>
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/audit-logs/${log.id}`)}
                  >
                    <TableCell className="text-sm whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.user_email || "system"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ACTION_VARIANT[log.action] ?? "outline"}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {log.entity_type.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {log.entity_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {log.action === "update" && log.after_state
                        ? `Changed: ${Object.keys(log.after_state).join(", ")}`
                        : log.action === "create"
                          ? "Created"
                          : "Deleted"}
                    </TableCell>
                  </TableRow>
                ))}
                {data?.logs.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No audit logs found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} log{data?.total !== 1 ? "s" : ""} total
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
