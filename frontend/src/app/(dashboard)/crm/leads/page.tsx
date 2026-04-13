"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { LEAD_SOURCES, LEAD_STATUSES } from "@/types/crm";
import type { LeadStatus } from "@/types/crm";
import { useCreateLead, useLeads } from "@/hooks/use-crm";
import { LeadDialog } from "@/components/crm/lead-dialog";
import { useDebounce } from "@/hooks/use-debounce";

const STATUS_VARIANT: Record<
  LeadStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  new: "secondary",
  contacting: "secondary",
  qualifying: "secondary",
  qualified: "default",
  disqualified: "outline",
  converted: "default",
};

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const params = useMemo(
    () => ({
      search: debounced || undefined,
      status: statusFilter === "all" ? undefined : (statusFilter as LeadStatus),
      limit: 100,
    }),
    [debounced, statusFilter],
  );

  const { data, isLoading } = useLeads(params);
  const createMutation = useCreateLead();

  const sourceLabel = (source: string) =>
    LEAD_SOURCES.find((s) => s.value === source)?.label ?? source;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Pre-intake prospects captured before compliance screening.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          New lead
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Est. value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (data?.leads.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No leads yet. Click “New lead” to add one.
                </TableCell>
              </TableRow>
            )}
            {data?.leads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/crm/leads/${lead.id}`}
                    className="hover:underline"
                  >
                    {lead.full_name}
                  </Link>
                </TableCell>
                <TableCell>{lead.company ?? "—"}</TableCell>
                <TableCell>{lead.email ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[lead.status]}>
                    {lead.status.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell>{sourceLabel(lead.source)}</TableCell>
                <TableCell className="text-right">
                  {lead.estimated_value
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      }).format(Number(lead.estimated_value))
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <LeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={async (data) => {
          await createMutation.mutateAsync(data);
        }}
      />
    </div>
  );
}
