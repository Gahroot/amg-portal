"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Download, FileText } from "lucide-react";

interface ReportContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onExport?: () => void;
  exportLabel?: string;
  onExportPdf?: () => void;
  isLoading?: boolean;
}

export function ReportContainer({
  title,
  subtitle,
  children,
  onExport,
  exportLabel = "Export CSV",
  onExportPdf,
  isLoading = false,
}: ReportContainerProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {onExportPdf && (
            <Button
              variant="outline"
              onClick={onExportPdf}
              disabled={isLoading}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Download PDF
            </Button>
          )}
          {onExport && (
            <Button
              variant="outline"
              onClick={onExport}
              disabled={isLoading}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {exportLabel}
            </Button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

interface ReportCardProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function ReportCard({ title, children, action }: ReportCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-serif text-lg">{title}</CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

interface ReportMetricProps {
  label: string;
  value: string | number;
  change?: string | number;
  trend?: "up" | "down" | "neutral";
}

export function ReportMetric({ label, value, change, trend }: ReportMetricProps) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {change !== undefined && (
        <p
          className={`text-xs ${
            trend === "up"
              ? "text-green-600"
              : trend === "down"
              ? "text-red-600"
              : "text-muted-foreground"
          }`}
        >
          {change}
        </p>
      )}
    </div>
  );
}

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  active: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  intake: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  design: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  on_hold: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  closed: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
};

export function ReportStatusBadge({ status, className = "" }: StatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] || STATUS_COLORS.pending;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass} ${className}`}
    >
      {status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
    </span>
  );
}
