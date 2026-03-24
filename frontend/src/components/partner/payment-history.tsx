"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Download,
  DollarSign,
  TrendingUp,
  Calendar,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useMyPayments, useMyPaymentSummary } from "@/hooks/use-partner-portal";
import { buildPaymentExportUrl, type PaymentListParams } from "@/lib/api/partner-portal";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  wire: "Wire Transfer",
  check: "Check",
  ach: "ACH",
  paypal: "PayPal",
  other: "Other",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: string, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(parseFloat(amount));
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards() {
  const { data: summary, isLoading } = useMyPaymentSummary();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-7 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Total Received (All Time)",
      value: summary ? formatCurrency(summary.total_all_time) : "—",
      icon: DollarSign,
      desc: `${summary?.payment_count ?? 0} payments`,
    },
    {
      label: "Year to Date",
      value: summary ? formatCurrency(summary.total_ytd) : "—",
      icon: Calendar,
      desc: `${summary?.payment_count_ytd ?? 0} payments this year`,
    },
    {
      label: "Average Payment",
      value: summary?.average_amount ? formatCurrency(summary.average_amount) : "—",
      icon: TrendingUp,
      desc: "Per payment (all time)",
    },
    {
      label: "Total Payments",
      value: summary ? String(summary.payment_count) : "—",
      icon: CreditCard,
      desc: `${summary?.payment_count_ytd ?? 0} YTD`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4">
            <CardTitle className="text-muted-foreground text-xs font-medium">
              {card.label}
            </CardTitle>
            <card.icon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold tracking-tight">{card.value}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">{card.desc}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Filters ─────────────────────────────────────────────────────────────────

interface FilterState {
  date_from: string;
  date_to: string;
  amount_min: string;
  amount_max: string;
  payment_method: string;
}

const EMPTY_FILTERS: FilterState = {
  date_from: "",
  date_to: "",
  amount_min: "",
  amount_max: "",
  payment_method: "",
};

function hasActiveFilters(f: FilterState): boolean {
  return Object.values(f).some(Boolean);
}

interface FiltersProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}

function Filters({ filters, onChange }: FiltersProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="gap-1.5"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {hasActiveFilters(filters) && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
              {Object.values(filters).filter(Boolean).length}
            </Badge>
          )}
        </Button>
        {hasActiveFilters(filters) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="gap-1 text-xs"
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {open && (
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div className="space-y-1">
              <Label className="text-xs">Date From</Label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => onChange({ ...filters, date_from: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date To</Label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => onChange({ ...filters, date_to: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Min Amount</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={filters.amount_min}
                onChange={(e) => onChange({ ...filters, amount_min: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max Amount</Label>
              <Input
                type="number"
                placeholder="Any"
                value={filters.amount_max}
                onChange={(e) => onChange({ ...filters, amount_max: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Payment Method</Label>
              <Select
                value={filters.payment_method || "all"}
                onValueChange={(v) =>
                  onChange({ ...filters, payment_method: v === "all" ? "" : v })
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Any method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any method</SelectItem>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Payment Table ────────────────────────────────────────────────────────────

interface PaymentTableProps {
  filters: FilterState;
}

function PaymentTable({ filters }: PaymentTableProps) {
  const [page, setPage] = React.useState(0);

  // Reset page when filters change
  React.useEffect(() => {
    setPage(0);
  }, [filters]);

  const params: PaymentListParams = {
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
    ...(filters.date_from ? { date_from: filters.date_from } : {}),
    ...(filters.date_to ? { date_to: filters.date_to } : {}),
    ...(filters.amount_min ? { amount_min: parseFloat(filters.amount_min) } : {}),
    ...(filters.amount_max ? { amount_max: parseFloat(filters.amount_max) } : {}),
    ...(filters.payment_method ? { payment_method: filters.payment_method } : {}),
  };

  const { data, isLoading } = useMyPayments(params);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const hasPrev = page > 0;
  const hasNext = page + 1 < totalPages;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.payments.length === 0) {
    return (
      <div className="text-muted-foreground py-16 text-center text-sm">
        No payments found{hasActiveFilters(filters) ? " matching the current filters" : ""}.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="hidden sm:table-cell">Method</TableHead>
              <TableHead className="hidden md:table-cell">Reference</TableHead>
              <TableHead className="hidden lg:table-cell">Assignment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="whitespace-nowrap font-medium">
                  {formatDate(payment.payment_date)}
                </TableCell>
                <TableCell className="whitespace-nowrap font-semibold text-green-700 dark:text-green-400">
                  {formatCurrency(payment.amount, payment.currency)}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="outline" className="text-xs">
                    {PAYMENT_METHOD_LABELS[payment.payment_method] ?? payment.payment_method}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground hidden max-w-[180px] truncate md:table-cell text-sm">
                  {payment.reference ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground hidden max-w-[200px] truncate lg:table-cell text-sm">
                  {payment.assignment_title ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          {data.total === 0
            ? "No results"
            : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, data.total)} of ${data.total}`}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            disabled={!hasPrev}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground px-2">
            {page + 1} / {Math.max(1, totalPages)}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            disabled={!hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PaymentHistory() {
  const [filters, setFilters] = React.useState<FilterState>(EMPTY_FILTERS);

  // Build the CSV export URL reflecting active filters
  const exportUrl = buildPaymentExportUrl({
    ...(filters.date_from ? { date_from: filters.date_from } : {}),
    ...(filters.date_to ? { date_to: filters.date_to } : {}),
    ...(filters.payment_method ? { payment_method: filters.payment_method } : {}),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment History</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            All payments received from AMG for completed work.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0 gap-1.5">
          <a href={exportUrl} download>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>
        </Button>
      </div>

      {/* Summary */}
      <SummaryCards />

      {/* Filters + Table */}
      <div className="space-y-4">
        <Filters filters={filters} onChange={setFilters} />
        <PaymentTable filters={filters} />
      </div>
    </div>
  );
}
