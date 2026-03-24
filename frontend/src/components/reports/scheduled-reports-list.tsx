"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MoreHorizontal,
  Play,
  Pencil,
  Trash2,
  Clock,
  CheckCircle2,
  FileText,
} from "lucide-react";
import type { ReportSchedule } from "@/lib/api/report-schedules";
import {
  REPORT_TYPE_LABELS,
  FREQUENCY_LABELS,
  FORMAT_LABELS,
} from "@/lib/api/report-schedules";

// ============================================================================
// Types
// ============================================================================

interface ScheduledReportsListProps {
  schedules: ReportSchedule[] | undefined;
  isLoading: boolean;
  onToggleActive: (schedule: ReportSchedule) => void;
  onEdit: (schedule: ReportSchedule) => void;
  onDelete: (schedule: ReportSchedule) => void;
  onExecute: (schedule: ReportSchedule) => void;
  executingId?: string | null;
  togglingId?: string | null;
  deletingId?: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFrequencyBadgeVariant(
  frequency: string,
): "default" | "secondary" | "outline" {
  if (frequency === "daily") return "default";
  if (frequency === "weekly") return "secondary";
  return "outline";
}

// ============================================================================
// Subcomponents
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Report</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>Format</TableHead>
            <TableHead>Next Run</TableHead>
            <TableHead>Last Run</TableHead>
            <TableHead>Recipients</TableHead>
            <TableHead>Active</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 8 }).map((__, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-4 w-full max-w-[120px]" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================================================
// Main component
// ============================================================================

export function ScheduledReportsList({
  schedules,
  isLoading,
  onToggleActive,
  onEdit,
  onDelete,
  onExecute,
  executingId,
  togglingId,
  deletingId,
}: ScheduledReportsListProps) {
  if (isLoading) return <LoadingSkeleton />;

  if (!schedules || schedules.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed bg-white p-8 text-center">
        <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <h3 className="font-medium text-muted-foreground">
          No scheduled reports
        </h3>
        <p className="mt-1 text-sm text-muted-foreground/70">
          Create a schedule to automatically generate and email reports on a
          recurring basis.
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Report</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Next Run</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((schedule) => (
              <TableRow
                key={schedule.id}
                className={schedule.is_active ? "" : "opacity-60"}
              >
                {/* Report type */}
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-sm">
                      {REPORT_TYPE_LABELS[schedule.report_type] ??
                        schedule.report_type}
                    </span>
                    {schedule.entity_id && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {schedule.entity_id.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* Frequency */}
                <TableCell>
                  <Badge
                    variant={getFrequencyBadgeVariant(schedule.frequency)}
                    className="text-xs capitalize"
                  >
                    {FREQUENCY_LABELS[schedule.frequency] ?? schedule.frequency}
                  </Badge>
                </TableCell>

                {/* Format */}
                <TableCell>
                  <Badge variant="outline" className="text-xs uppercase">
                    {FORMAT_LABELS[schedule.format] ?? schedule.format}
                  </Badge>
                </TableCell>

                {/* Next run */}
                <TableCell>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {schedule.is_active ? (
                      <span>{formatDateTime(schedule.next_run)}</span>
                    ) : (
                      <span className="text-muted-foreground">Paused</span>
                    )}
                  </div>
                </TableCell>

                {/* Last run */}
                <TableCell>
                  {schedule.last_run ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-default">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          {formatDateTime(schedule.last_run)}
                        </div>
                      </TooltipTrigger>
                      {schedule.last_generated_document_id && (
                        <TooltipContent>
                          <p className="font-mono text-xs">
                            Doc: {schedule.last_generated_document_id.slice(0, 8)}…
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  ) : (
                    <span className="text-sm text-muted-foreground">Never</span>
                  )}
                </TableCell>

                {/* Recipients */}
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {schedule.recipients.slice(0, 2).map((r) => (
                      <Badge key={r} variant="outline" className="text-xs">
                        {r}
                      </Badge>
                    ))}
                    {schedule.recipients.length > 2 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-xs cursor-default">
                            +{schedule.recipients.length - 2} more
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="space-y-1">
                            {schedule.recipients.slice(2).map((r) => (
                              <p key={r} className="text-xs">
                                {r}
                              </p>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {schedule.recipients.length === 0 && (
                      <span className="text-xs text-muted-foreground">None</span>
                    )}
                  </div>
                </TableCell>

                {/* Active toggle */}
                <TableCell>
                  <Switch
                    checked={schedule.is_active}
                    disabled={togglingId === schedule.id}
                    onCheckedChange={() => onToggleActive(schedule)}
                    aria-label={
                      schedule.is_active ? "Pause schedule" : "Resume schedule"
                    }
                  />
                </TableCell>

                {/* Actions dropdown */}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => onExecute(schedule)}
                        disabled={executingId === schedule.id}
                      >
                        <Play className="mr-2 h-3.5 w-3.5" />
                        {executingId === schedule.id
                          ? "Running…"
                          : "Execute Now"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(schedule)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(schedule)}
                        disabled={deletingId === schedule.id}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
