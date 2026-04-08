"use client";

import * as React from "react";
import { useAuth } from "@/providers/auth-provider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScheduleReportDialog } from "@/components/reports/schedule-report-dialog";
import { ScheduledReportsList } from "@/components/reports/scheduled-reports-list";
import {
  listReportSchedules,
  createReportSchedule,
  updateReportSchedule,
  deleteReportSchedule,
  executeReportSchedule,
} from "@/lib/api/report-schedules";
import type {
  ReportSchedule,
  ReportScheduleCreate,
  ReportScheduleUpdate,
} from "@/lib/api/report-schedules";

// ============================================================================
// Access control
// ============================================================================

const ALLOWED_ROLES = [
  "coordinator",
  "relationship_manager",
  "managing_director",
  "finance_compliance",
];

// ============================================================================
// Page
// ============================================================================

export default function ReportSchedulesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const { data: schedules, isLoading } = useQuery({
    queryKey: ["report-schedules"],
    queryFn: listReportSchedules,
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: ReportScheduleCreate) => createReportSchedule(data),
    onSuccess: () => {
      toast.success("Report schedule created");
      queryClient.invalidateQueries({ queryKey: ["report-schedules"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Failed to create schedule"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReportScheduleUpdate }) =>
      updateReportSchedule(id, data),
    onSuccess: () => {
      toast.success("Schedule updated");
      queryClient.invalidateQueries({ queryKey: ["report-schedules"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Failed to update schedule"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReportSchedule(id),
    onSuccess: () => {
      toast.success("Schedule deleted");
      queryClient.invalidateQueries({ queryKey: ["report-schedules"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Failed to delete schedule"),
  });

  const executeMutation = useMutation({
    mutationFn: (id: string) => executeReportSchedule(id),
    onSuccess: () => {
      toast.success("Report generated and emailed to recipients");
      queryClient.invalidateQueries({ queryKey: ["report-schedules"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Failed to execute schedule"),
  });

  // ── Dialog state ───────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingSchedule, setEditingSchedule] =
    React.useState<ReportSchedule | null>(null);

  function openCreate() {
    setEditingSchedule(null);
    setDialogOpen(true);
  }

  function openEdit(schedule: ReportSchedule) {
    setEditingSchedule(schedule);
    setDialogOpen(true);
  }

  function handleClose() {
    setDialogOpen(false);
    setEditingSchedule(null);
  }

  // ── Form submission ────────────────────────────────────────────────────────
  async function handleSubmit(
    data: ReportScheduleCreate | ReportScheduleUpdate,
    id?: string,
  ) {
    if (id) {
      await updateMutation.mutateAsync({ id, data: data as ReportScheduleUpdate });
    } else {
      await createMutation.mutateAsync(data as ReportScheduleCreate);
    }
    handleClose();
  }

  // ── Access guard ───────────────────────────────────────────────────────────
  if (!user) return null;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-6 w-6 text-muted-foreground" />
              <h1 className="font-serif text-3xl font-bold tracking-tight">
                Report Schedules
              </h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Automatically generate and email reports to recipients on a
              recurring schedule.
            </p>
          </div>
          <Button onClick={openCreate} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            New Schedule
          </Button>
        </div>

        {/* Stats bar */}
        {schedules && schedules.length > 0 && (
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{schedules.length}</strong>{" "}
              schedule{schedules.length !== 1 ? "s" : ""}
            </span>
            <span>
              <strong className="text-foreground">
                {schedules.filter((s) => s.is_active).length}
              </strong>{" "}
              active
            </span>
            <span>
              <strong className="text-foreground">
                {schedules.filter((s) => s.last_run).length}
              </strong>{" "}
              run at least once
            </span>
          </div>
        )}

        {/* List */}
        <ScheduledReportsList
          schedules={schedules}
          isLoading={isLoading}
          onToggleActive={(schedule) =>
            updateMutation.mutate({
              id: schedule.id,
              data: { is_active: !schedule.is_active },
            })
          }
          onEdit={openEdit}
          onDelete={(schedule) => {
            if (
              window.confirm(
                `Delete the "${schedule.report_type.replace(/_/g, " ")}" schedule? This cannot be undone.`,
              )
            ) {
              deleteMutation.mutate(schedule.id);
            }
          }}
          onExecute={(schedule) => executeMutation.mutate(schedule.id)}
          executingId={executeMutation.isPending ? (executeMutation.variables ?? null) : null}
          togglingId={
            updateMutation.isPending ? (updateMutation.variables?.id ?? null) : null
          }
          deletingId={deleteMutation.isPending ? (deleteMutation.variables ?? null) : null}
        />
      </div>

      {/* Create / Edit dialog */}
      <ScheduleReportDialog
        open={dialogOpen}
        onClose={handleClose}
        schedule={editingSchedule}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
