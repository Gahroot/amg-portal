"use client";

import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Receipt,
  Plus,
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useInvoices } from "@/hooks/use-invoices";
import { useClientProfiles } from "@/hooks/use-clients";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Separator } from "@/components/ui/separator";
import type { Invoice, InvoiceStatus, InvoiceCreate, InvoiceUpdate } from "@/types/invoice";
import { queryKeys } from "@/lib/query-keys";
import { Balancer } from "react-wrap-balancer";

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

function buildColumns(
  clientMap: ClientMap,
  onView: (invoice: Invoice) => void,
  onEdit: (invoice: Invoice) => void,
  onDelete: (invoice: Invoice) => void
): ColumnDef<Invoice>[] {
  return [
    {
      accessorKey: "id",
      header: "Invoice ID",
      cell: ({ row }) => (
        <button
          onClick={() => onView(row.original)}
          className="font-mono text-xs text-primary underline-offset-4 hover:underline"
        >
          {row.original.id.slice(0, 8)}…
        </button>
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
          {formatDate(row.original.due_date ?? null)}
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
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(row.original)}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(row.original)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(row.original)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}

// ─── Invoice Detail Sheet ─────────────────────────────────────────────────────

function InvoiceDetailSheet({
  invoice,
  clientMap,
  onClose,
}: {
  invoice: Invoice | null;
  clientMap: ClientMap;
  onClose: () => void;
}) {
  if (!invoice) return null;
  const status = invoice.status as InvoiceStatus;
  return (
    <Sheet open={invoice !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Invoice Details
          </SheetTitle>
          <SheetDescription className="font-mono text-xs">
            {invoice.id}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge
              variant={getStatusVariant(status)}
              className={getStatusClassName(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Client</p>
              <p className="font-medium">
                {clientMap[invoice.client_id] ?? invoice.client_id.slice(0, 8)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Amount</p>
              <p className="font-medium tabular-nums">{formatCurrency(invoice.amount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Due Date</p>
              <p className="font-medium">{formatDate(invoice.due_date ?? null)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">{formatDate(invoice.created_at)}</p>
            </div>
          </div>
          {invoice.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{invoice.notes}</p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Invoice Form Dialog ──────────────────────────────────────────────────────

interface InvoiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: Invoice | null;
  clients: Array<{ id: string; name: string }>;
  onSubmit: (data: InvoiceCreate | InvoiceUpdate) => Promise<void>;
  isPending: boolean;
}

function InvoiceFormDialog({
  open,
  onOpenChange,
  invoice,
  clients,
  onSubmit,
  isPending,
}: InvoiceFormDialogProps) {
  const isEdit = !!invoice;

  const [clientId, setClientId] = useState(invoice?.client_id ?? "");
  const [amount, setAmount] = useState(invoice?.amount ?? "");
  const [status, setStatus] = useState<string>(invoice?.status ?? "draft");
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? "");
  const [notes, setNotes] = useState(invoice?.notes ?? "");

  // Reset form when invoice changes using a ref-based approach
  const invoiceId = invoice?.id ?? null;
  useMemo(() => {
    setClientId(invoice?.client_id ?? "");
    setAmount(invoice?.amount ?? "");
    setStatus(invoice?.status ?? "draft");
    setDueDate(invoice?.due_date ?? "");
    setNotes(invoice?.notes ?? "");
  // We only want to reset when the invoiceId changes, not on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit) {
      await onSubmit({
        amount: amount ? Number(amount) : undefined,
        status: status || undefined,
        due_date: dueDate || undefined,
        notes: notes || undefined,
      } satisfies InvoiceUpdate);
    } else {
      await onSubmit({
        client_id: clientId,
        amount: Number(amount),
        status,
        due_date: dueDate || undefined,
        notes: notes || undefined,
      } satisfies InvoiceCreate);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Invoice" : "Create Invoice"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the invoice details below." : "Fill in the details to create a new invoice."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="client">Client</Label>
              <Select value={clientId} onValueChange={setClientId} required>
                <SelectTrigger id="client">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (USD)</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required={!isEdit}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVOICE_STATUSES.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="due_date">Due Date</Label>
            <Input
              id="due_date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes…"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialog/sheet state
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDeleteInvoice, setPendingDeleteInvoice] = useState<Invoice | null>(null);

  const { data: clientData } = useClientProfiles({ limit: 200 });

  const clientMap = useMemo<ClientMap>(() => {
    const map: ClientMap = {};
    for (const profile of clientData?.profiles ?? []) {
      map[profile.id] = profile.display_name ?? profile.legal_name;
    }
    return map;
  }, [clientData]);

  const clientList = useMemo(
    () =>
      (clientData?.profiles ?? []).map((p) => ({
        id: p.id,
        name: p.display_name ?? p.legal_name,
      })),
    [clientData]
  );

  const queryParams = {
    limit: 100,
    ...(clientFilter !== "all" ? { client_id: clientFilter } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
  };

  const { data, isLoading } = useInvoices(queryParams);

  const createMutation = useMutation({
    mutationFn: (data: InvoiceCreate) =>
      api.post("/api/v1/invoices/", data).then((r) => r.data),
    onSuccess: () => {
      toast.success("Invoice created");
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      setCreateOpen(false);
    },
    onError: () => toast.error("Failed to create invoice"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InvoiceUpdate }) =>
      api.patch(`/api/v1/invoices/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      toast.success("Invoice updated");
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      setEditingInvoice(null);
    },
    onError: () => toast.error("Failed to update invoice"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/invoices/${id}`),
    onSuccess: () => {
      toast.success("Invoice deleted");
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      setPendingDeleteInvoice(null);
    },
    onError: () => toast.error("Failed to delete invoice"),
  });

  const columns = useMemo(
    () =>
      buildColumns(
        clientMap,
        setViewingInvoice,
        setEditingInvoice,
        setPendingDeleteInvoice
      ),
    [clientMap]
  );

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Receipt className="h-7 w-7 text-muted-foreground" />
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              <Balancer>Finance</Balancer>
            </h1>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Button>
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

      {/* Invoice Detail Sheet */}
      <InvoiceDetailSheet
        invoice={viewingInvoice}
        clientMap={clientMap}
        onClose={() => setViewingInvoice(null)}
      />

      {/* Create Invoice Dialog */}
      <InvoiceFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        clients={clientList}
        onSubmit={async (data) => {
          await createMutation.mutateAsync(data as InvoiceCreate);
        }}
        isPending={createMutation.isPending}
      />

      {/* Edit Invoice Dialog */}
      <InvoiceFormDialog
        open={editingInvoice !== null}
        onOpenChange={(open) => !open && setEditingInvoice(null)}
        invoice={editingInvoice}
        clients={clientList}
        onSubmit={async (data) => {
          if (editingInvoice) {
            await updateMutation.mutateAsync({
              id: editingInvoice.id,
              data: data as InvoiceUpdate,
            });
          }
        }}
        isPending={updateMutation.isPending}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={pendingDeleteInvoice !== null}
        onOpenChange={(open) => !open && setPendingDeleteInvoice(null)}
        title="Delete invoice?"
        description={`Delete invoice ${pendingDeleteInvoice?.id.slice(0, 8)}…? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDeleteInvoice) {
            deleteMutation.mutate(pendingDeleteInvoice.id);
          }
        }}
      />
    </div>
  );
}
