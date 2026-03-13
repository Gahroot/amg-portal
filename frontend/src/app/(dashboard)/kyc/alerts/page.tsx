"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { useKYCAlerts, useMarkKYCAlertRead, useResolveKYCAlert } from "@/hooks/use-kyc-alerts";
import type { KYCAlertSeverity, KYCAlertStatus, KYCAlertType } from "@/types/kyc-alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bell,
  CheckCircle,
  Eye,
  ShieldAlert,
} from "lucide-react";

const ALLOWED_ROLES = [
  "finance_compliance",
  "managing_director",
  "relationship_manager",
  "coordinator",
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "resolved", label: "Resolved" },
];

const SEVERITY_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Severities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "document_expired", label: "Document Expired" },
  { value: "document_expiring", label: "Document Expiring" },
  { value: "verification_failed", label: "Verification Failed" },
  { value: "compliance_flag", label: "Compliance Flag" },
  { value: "sanctions_match", label: "Sanctions Match" },
  { value: "pep_match", label: "PEP Match" },
  { value: "adverse_media", label: "Adverse Media" },
  { value: "risk_level_change", label: "Risk Level Change" },
];

const SEVERITY_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

const STATUS_ICON: Record<string, React.ElementType> = {
  new: Bell,
  read: Eye,
  resolved: CheckCircle,
};

function formatAlertType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function KYCAlertPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [severityFilter, setSeverityFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [resolveDialogOpen, setResolveDialogOpen] = React.useState(false);
  const [resolveAlertId, setResolveAlertId] = React.useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = React.useState("");

  const isAllowed = user && ALLOWED_ROLES.includes(user.role);

  const { data, isLoading } = useKYCAlerts({
    status: statusFilter !== "all" ? (statusFilter as KYCAlertStatus) : undefined,
    severity: severityFilter !== "all" ? (severityFilter as KYCAlertSeverity) : undefined,
    alert_type: typeFilter !== "all" ? (typeFilter as KYCAlertType) : undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const markRead = useMarkKYCAlertRead();
  const resolveAlert = useResolveKYCAlert();

  const handleMarkRead = (id: string) => {
    markRead.mutate(id);
  };

  const handleOpenResolve = (id: string) => {
    setResolveAlertId(id);
    setResolutionNotes("");
    setResolveDialogOpen(true);
  };

  const handleResolve = () => {
    if (!resolveAlertId) return;
    resolveAlert.mutate(
      {
        id: resolveAlertId,
        data: resolutionNotes ? { resolution_notes: resolutionNotes } : undefined,
      },
      {
        onSuccess: () => {
          setResolveDialogOpen(false);
          setResolveAlertId(null);
          setResolutionNotes("");
        },
      },
    );
  };

  if (!isAllowed) {
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
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-amber-600" />
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              KYC Alerts
            </h1>
          </div>
          <Button asChild variant="outline">
            <Link href="/kyc">Back to KYC Dashboard</Link>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
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

          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by severity" />
            </SelectTrigger>
            <SelectContent>
              {SEVERITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="w-[160px]"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="date"
              className="w-[160px]"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To"
            />
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading alerts...</p>
        ) : (
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.alerts.map((alert) => {
                  const StatusIcon = STATUS_ICON[alert.status] ?? Bell;
                  return (
                    <TableRow
                      key={alert.id}
                      className={alert.status === "new" ? "bg-amber-50/50" : ""}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm capitalize">{alert.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={SEVERITY_VARIANT[alert.severity] ?? "outline"}>
                          {alert.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatAlertType(alert.alert_type)}
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate font-medium">
                        {alert.title}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/clients/${alert.client_id}`}
                          className="text-sm hover:underline"
                        >
                          {alert.client_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(alert.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {alert.status === "new" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkRead(alert.id)}
                              disabled={markRead.isPending}
                            >
                              <Eye className="mr-1 h-3 w-3" />
                              Read
                            </Button>
                          )}
                          {alert.status !== "resolved" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleOpenResolve(alert.id)}
                            >
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Resolve
                            </Button>
                          )}
                          {alert.status === "resolved" && alert.resolution_notes && (
                            <span
                              className="max-w-[150px] truncate text-xs text-muted-foreground"
                              title={alert.resolution_notes}
                            >
                              {alert.resolution_notes}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!data || data.alerts.length === 0) && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground"
                    >
                      No alerts found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {data && (
          <p className="text-sm text-muted-foreground">
            {data.total} alert{data.total !== 1 ? "s" : ""} total
          </p>
        )}
      </div>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve Alert</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Resolution Notes (optional)</Label>
              <Textarea
                placeholder="Describe how this alert was resolved..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setResolveDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleResolve}
                disabled={resolveAlert.isPending}
              >
                {resolveAlert.isPending ? "Resolving..." : "Resolve Alert"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
