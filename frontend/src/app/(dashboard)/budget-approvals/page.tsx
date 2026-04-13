"use client";

import Link from "next/link";
import { DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useBudgetApprovalRequests,
  usePendingBudgetApprovals,
} from "@/hooks/use-budget-approvals";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatRequestType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "approved":
      return "default";
    case "rejected":
    case "cancelled":
    case "expired":
      return "destructive";
    case "in_review":
      return "secondary";
    default:
      return "outline";
  }
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function PendingTab() {
  const { data, isLoading } = usePendingBudgetApprovals();

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  const items = data?.items ?? [];

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Program</TableHead>
            <TableHead>Request</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Step</TableHead>
            <TableHead>Requested By</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.program_title}</TableCell>
              <TableCell>{item.request_title}</TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {formatRequestType(item.request_type)}
                </Badge>
              </TableCell>
              <TableCell className="tabular-nums">
                {formatCurrency(item.requested_amount)}
              </TableCell>
              <TableCell>Step {item.step_number}</TableCell>
              <TableCell className="text-muted-foreground">
                {item.requester_name}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(item.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Button asChild size="sm">
                  <Link href={`/budget-approvals/${item.request_id}`}>
                    Review
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={8}
                className="py-8 text-center text-muted-foreground"
              >
                No pending approvals for your account.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function AllTab() {
  const { data, isLoading } = useBudgetApprovalRequests({ limit: 50 });

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  const items = data?.items ?? [];

  return (
    <>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Program</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Chain Progress</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((req) => (
              <TableRow key={req.id}>
                <TableCell className="font-medium">
                  {req.program_title}
                </TableCell>
                <TableCell>{req.title}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {formatRequestType(req.request_type)}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatCurrency(Number(req.requested_amount))}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(req.status)}>
                    {formatStatus(req.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {req.total_steps > 0
                    ? `${req.current_step} / ${req.total_steps}`
                    : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {req.requester_name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(req.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/budget-approvals/${req.id}`}>View</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-8 text-center text-muted-foreground"
                >
                  No budget approval requests found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {data && (
        <p className="mt-2 text-sm text-muted-foreground">
          Showing {items.length} of {data.total} request
          {data.total !== 1 ? "s" : ""}
        </p>
      )}
    </>
  );
}

export default function BudgetApprovalsPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-3">
          <DollarSign className="h-7 w-7 text-muted-foreground" />
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Budget Approvals
          </h1>
        </div>
        <p className="text-muted-foreground">
          Review and act on budget approval requests routed through the
          multi-step approval chain.
        </p>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending My Action</TabsTrigger>
            <TabsTrigger value="all">All Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <PendingTab />
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <AllTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
