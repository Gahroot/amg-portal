"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Receipt } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useInvoices } from "@/hooks/use-invoices";
import { useClientProfiles } from "@/hooks/use-clients";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Invoice, InvoiceStatus } from "@/types/invoice";

const ALLOWED_ROLES = ["finance_compliance", "managing_director"];

const INVOICE_STATUSES: { value: InvoiceStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

function getStatusVariant(
  status: InvoiceStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "paid":
      return "default";
    case "overdue":
      return "destructive";
    case "sent":
      return "secondary";
    case "cancelled":
      return "destructive";
    case "draft":
    default:
      return "outline";
  }
}

function getStatusClassName(status: InvoiceStatus): string {
  switch (status) {
    case "paid":
      return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    case "overdue":
      return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800";
    case "sent":
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    case "cancelled":
      return "bg-muted text-muted-foreground border-border";
    case "draft":
    default:
      return "bg-muted text-foreground/80 border-border";
  }
}

function formatCurrency(amount: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type ClientMap = Record<string, string>;

function buildColumns(clientMap: ClientMap): ColumnDef<Invoice>[] {
  return [
    {
      accessorKey: "id",
      header: "Invoice ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.id.slice(0, 8)}…
        </span>
      ),
    },
    {
      accessorKey: "client_id",
      header: "Client",
      cell: ({ row }) => (
        <span className="font-medium">
          {clientMap[row.original.client_id] ?? row.original.client_id.slice(0, 8)}
        </span>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => (
        <span className="tabular-nums">{formatCurrency(row.original.amount)}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status as InvoiceStatus;
        return (
          <Badge
            variant={getStatusVariant(status)}
            className={getStatusClassName(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "due_date",
      header: "Due Date",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDate(row.original.due_date)}
        </span>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatDate(row.original.created_at)}
        </span>
      ),
    },
    {
      accessorKey: "notes",
      header: "Notes",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm truncate max-w-[200px] block">
          {row.original.notes ?? "—"}
        </span>
      ),
    },
  ];
}

export default function FinancePage() {
  const { user } = useAuth();
  const [clientFilter, setClientFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const { data: clientData } = useClientProfiles({ limit: 200 });

  const clientMap = React.useMemo<ClientMap>(() => {
    const map: ClientMap = {};
    for (const profile of clientData?.profiles ?? []) {
      map[profile.id] = profile.display_name ?? profile.legal_name;
    }
    return map;
  }, [clientData]);

  const queryParams = {
    limit: 100,
    ...(clientFilter !== "all" ? { client_id: clientFilter } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
  };

  const { data, isLoading } = useInvoices(queryParams);

  const columns = React.useMemo(() => buildColumns(clientMap), [clientMap]);

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  const invoices = data?.invoices ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Receipt className="h-7 w-7 text-muted-foreground" />
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Finance
          </h1>
        </div>
        <p className="text-muted-foreground">
          Review and manage invoices across all clients and programs.
        </p>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-52 bg-card">
              <SelectValue placeholder="Filter by client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {(clientData?.profiles ?? []).map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.display_name ?? profile.legal_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 bg-card">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {INVOICE_STATUSES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading invoices…
          </p>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={invoices}
              emptyMessage="No invoices found for the selected filters."
            />
            <p className="text-sm text-muted-foreground">
              Showing {invoices.length} of {total} invoice
              {total !== 1 ? "s" : ""}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
