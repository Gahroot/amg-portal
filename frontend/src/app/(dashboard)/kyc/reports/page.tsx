"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import {
  useComplianceReports,
  useGenerateComplianceReport,
  useDownloadComplianceReport,
} from "@/hooks/use-compliance-reports";
import type {
  ComplianceReportType,
  ComplianceReportGenerateRequest,
  ComplianceReportFormat,
} from "@/types/compliance-report";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, FileText, Plus } from "lucide-react";

const ALLOWED_ROLES = [
  "finance_compliance",
  "managing_director",
  "relationship_manager",
  "coordinator",
];

const REPORT_TYPE_OPTIONS: { value: ComplianceReportType; label: string }[] = [
  { value: "kyc_summary", label: "KYC Summary" },
  { value: "risk_assessment", label: "Risk Assessment" },
  { value: "aml_screening", label: "AML Screening" },
  { value: "sanctions_check", label: "Sanctions Check" },
  { value: "regulatory_filing", label: "Regulatory Filing" },
  { value: "audit_trail", label: "Audit Trail" },
];

const FORMAT_OPTIONS: { value: ComplianceReportFormat; label: string }[] = [
  { value: "pdf", label: "PDF" },
  { value: "csv", label: "CSV" },
  { value: "xlsx", label: "Excel (XLSX)" },
];

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  completed: "default",
  generating: "secondary",
  pending: "outline",
  failed: "destructive",
};

function formatReportType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ComplianceReportsPage() {
  const { user } = useAuth();
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [formData, setFormData] = React.useState<ComplianceReportGenerateRequest>({
    report_type: "kyc_summary",
    title: "",
    format: "pdf",
  });

  const isAllowed = user && ALLOWED_ROLES.includes(user.role);

  const { data, isLoading } = useComplianceReports({
    report_type:
      typeFilter !== "all" ? (typeFilter as ComplianceReportType) : undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const generateMutation = useGenerateComplianceReport();
  const { downloadReport } = useDownloadComplianceReport();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generateMutation.mutate(formData, {
      onSuccess: () => {
        setDialogOpen(false);
        setFormData({
          report_type: "kyc_summary",
          title: "",
          format: "pdf",
        });
      },
    });
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
            <FileText className="h-8 w-8 text-blue-600" />
            <h1 className="font-serif text-3xl font-bold tracking-tight">
              Compliance Reports
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/kyc">Back to KYC Dashboard</Link>
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Generate Report
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Generate Compliance Report</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Report Type</Label>
                    <Select
                      value={formData.report_type}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          report_type: value as ComplianceReportType,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REPORT_TYPE_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Report Title</Label>
                    <Input
                      placeholder="e.g. Q1 2026 KYC Summary"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select
                      value={formData.format}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          format: value as ComplianceReportFormat,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMAT_OPTIONS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={generateMutation.isPending || !formData.title}
                    >
                      {generateMutation.isPending
                        ? "Generating..."
                        : "Generate"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {REPORT_TYPE_OPTIONS.map((opt) => (
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
          <p className="text-muted-foreground text-sm">Loading reports...</p>
        ) : (
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Generated By</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="max-w-[250px] truncate font-medium">
                      {report.title}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatReportType(report.report_type)}
                    </TableCell>
                    <TableCell className="uppercase text-sm">
                      {report.format}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_VARIANT[report.status] ?? "outline"}
                      >
                        {report.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {report.generated_by_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(report.created_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(report.completed_at)}
                    </TableCell>
                    <TableCell>
                      {report.status === "completed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadReport(report.id)}
                        >
                          <Download className="mr-1 h-3 w-3" />
                          Download
                        </Button>
                      )}
                      {report.status === "generating" && (
                        <span className="text-xs text-muted-foreground">
                          In progress...
                        </span>
                      )}
                      {report.status === "failed" && (
                        <span className="text-xs text-red-600">Failed</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(!data || data.reports.length === 0) && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground"
                    >
                      No compliance reports found. Generate one to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {data && (
          <p className="text-sm text-muted-foreground">
            {data.total} report{data.total !== 1 ? "s" : ""} total
          </p>
        )}
      </div>
    </div>
  );
}
