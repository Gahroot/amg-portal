"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  parseISO,
  isToday,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { usePortalMilestones } from "@/hooks/use-portal-programs";
import { usePortalPrograms } from "@/hooks/use-portal-programs";
import type { CalendarMilestone } from "@/lib/api/client-portal";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "month" | "week";

// ─── Constants ────────────────────────────────────────────────────────────────

const MILESTONE_STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string; dotColor: string }
> = {
  pending: {
    label: "Pending",
    icon: <Circle className="h-3.5 w-3.5" />,
    color: "text-muted-foreground",
    dotColor: "bg-muted-foreground",
  },
  in_progress: {
    label: "In Progress",
    icon: <Clock className="h-3.5 w-3.5 text-amber-500" />,
    color: "text-amber-600",
    dotColor: "bg-amber-500",
  },
  at_risk: {
    label: "At Risk",
    icon: <AlertCircle className="h-3.5 w-3.5 text-red-500" />,
    color: "text-red-600",
    dotColor: "bg-red-500",
  },
  completed: {
    label: "Completed",
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
    color: "text-green-600",
    dotColor: "bg-green-500",
  },
  cancelled: {
    label: "Cancelled",
    icon: <XCircle className="h-3.5 w-3.5 text-muted-foreground" />,
    color: "text-muted-foreground",
    dotColor: "bg-muted-foreground/40",
  },
};

// Consistent program colors — assigned by index for visual variety
const PROGRAM_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-rose-500",
];

// ─── Detail Dialog ─────────────────────────────────────────────────────────────

interface MilestoneDetailDialogProps {
  milestone: CalendarMilestone | null;
  programColor: string;
  onClose: () => void;
}

function MilestoneDetailDialog({
  milestone,
  programColor,
  onClose,
}: MilestoneDetailDialogProps) {
  if (!milestone) return null;

  const statusCfg =
    MILESTONE_STATUS_CONFIG[milestone.status] ?? MILESTONE_STATUS_CONFIG.pending;

  return (
    <Dialog open={!!milestone} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug pr-6">
            {milestone.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {/* Program badge */}
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full shrink-0 ${programColor}`} />
            <Link
              href={`/portal/programs/${milestone.program_id}`}
              className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
              onClick={onClose}
            >
              {milestone.program_title}
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            {statusCfg.icon}
            <span className={`text-sm font-medium ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>

          {/* Due date */}
          {milestone.due_date && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                Due{" "}
                {format(parseISO(milestone.due_date), "MMMM d, yyyy")}
              </span>
            </div>
          )}

          {/* Description */}
          {milestone.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {milestone.description}
            </p>
          )}

          {/* Link to program */}
          <div className="pt-2 border-t">
            <Link
              href={`/portal/programs/${milestone.program_id}`}
              onClick={onClose}
            >
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />
                View Program
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MilestoneCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedProgramId, setSelectedProgramId] = useState<string>("all");
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [selectedMilestone, setSelectedMilestone] =
    useState<CalendarMilestone | null>(null);

  const { data: programs = [] } = usePortalPrograms();

  const { data: milestones = [], isLoading } = usePortalMilestones({
    program_id: selectedProgramId !== "all" ? selectedProgramId : undefined,
    upcoming_only: upcomingOnly,
  });

  // Build a stable program → color map based on program list order
  const programColorMap = useMemo(() => {
    const map = new Map<string, string>();
    programs.forEach((p, idx) => {
      map.set(p.id, PROGRAM_COLORS[idx % PROGRAM_COLORS.length]);
    });
    return map;
  }, [programs]);

  const getMilestoneColor = (programId: string) =>
    programColorMap.get(programId) ?? "bg-gray-500";

  // Date range for calendar grid
  const dateRange = useMemo(() => {
    if (viewMode === "week") {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      };
    }
    return {
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate),
    };
  }, [currentDate, viewMode]);

  const days = eachDayOfInterval(dateRange);

  // Group milestones by due_date string
  const milestonesByDay = useMemo(() => {
    const map = new Map<string, CalendarMilestone[]>();
    for (const m of milestones) {
      if (!m.due_date) continue;
      const key = m.due_date; // "YYYY-MM-DD"
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [milestones]);

  const getMilestonesForDay = (day: Date) => {
    const key = format(day, "yyyy-MM-dd");
    return milestonesByDay.get(key) ?? [];
  };

  const navigateForward = () => {
    if (viewMode === "week") setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addMonths(d, 1));
  };

  const navigateBack = () => {
    if (viewMode === "week") setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subMonths(d, 1));
  };

  const selectedMilestoneColor = selectedMilestone
    ? getMilestoneColor(selectedMilestone.program_id)
    : "";

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {/* Title + nav */}
            <div className="flex items-center gap-2">
              <CardTitle>
                {viewMode === "week"
                  ? `Week of ${format(dateRange.start, "MMM d, yyyy")}`
                  : format(currentDate, "MMMM yyyy")}
              </CardTitle>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* View toggle */}
              <div className="flex rounded-md border">
                <Button
                  variant={viewMode === "month" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("month")}
                  className="rounded-r-none"
                >
                  Month
                </Button>
                <Button
                  variant={viewMode === "week" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("week")}
                  className="rounded-l-none"
                >
                  Week
                </Button>
              </div>

              {/* Navigation */}
              <Button variant="outline" size="icon" onClick={navigateBack}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={navigateForward}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            {/* Program filter */}
            <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
              <SelectTrigger className="w-48 h-8 text-sm">
                <SelectValue placeholder="All programs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All programs</SelectItem>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${getMilestoneColor(p.id)}`}
                      />
                      {p.title}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Upcoming only toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="upcoming-only"
                checked={upcomingOnly}
                onCheckedChange={setUpcomingOnly}
              />
              <Label htmlFor="upcoming-only" className="text-sm cursor-pointer">
                Upcoming only
              </Label>
            </div>

            {/* Program legend */}
            {selectedProgramId === "all" && programs.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 ml-auto">
                {programs.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${getMilestoneColor(p.id)}`}
                    />
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {p.title}
                    </span>
                  </div>
                ))}
                {programs.length > 5 && (
                  <span className="text-xs text-muted-foreground">
                    +{programs.length - 5} more
                  </span>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              Loading milestones…
            </div>
          ) : (
            <>
              {/* ── Month View ── */}
              {viewMode === "month" && (
                <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                    (day) => (
                      <div
                        key={day}
                        className="bg-background p-2 text-center text-xs font-medium text-muted-foreground"
                      >
                        {day}
                      </div>
                    ),
                  )}
                  {days.map((day) => {
                    const dayMilestones = getMilestonesForDay(day);
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const todayFlag = isToday(day);
                    return (
                      <div
                        key={day.toISOString()}
                        className={[
                          "bg-background p-2 min-h-[90px]",
                          !isCurrentMonth ? "opacity-40" : "",
                          todayFlag ? "ring-2 ring-primary ring-inset" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <div
                          className={`text-xs font-medium mb-1 ${todayFlag ? "text-primary font-bold" : ""}`}
                        >
                          {format(day, "d")}
                        </div>
                        <div className="space-y-0.5">
                          {dayMilestones.slice(0, 3).map((m) => {
                            const color = getMilestoneColor(m.program_id);
                            return (
                              <button
                                key={m.id}
                                onClick={() => setSelectedMilestone(m)}
                                className="w-full text-left rounded-sm hover:bg-muted transition-colors"
                              >
                                <div className="flex items-center gap-1 px-1 py-0.5">
                                  <div
                                    className={`h-2 w-2 rounded-full shrink-0 ${color}`}
                                  />
                                  <span
                                    className={`text-xs truncate leading-tight ${
                                      m.status === "cancelled"
                                        ? "line-through text-muted-foreground"
                                        : m.status === "completed"
                                          ? "text-muted-foreground"
                                          : ""
                                    }`}
                                  >
                                    {m.title}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                          {dayMilestones.length > 3 && (
                            <div className="text-xs text-muted-foreground px-1">
                              +{dayMilestones.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Week View ── */}
              {viewMode === "week" && (
                <div className="space-y-2">
                  {days.map((day) => {
                    const dayMilestones = getMilestonesForDay(day);
                    const todayFlag = isToday(day);
                    return (
                      <div
                        key={day.toISOString()}
                        className="flex gap-4 border-b pb-3 last:border-0"
                      >
                        {/* Day label */}
                        <div
                          className={`w-16 shrink-0 text-sm font-medium ${todayFlag ? "text-primary" : ""}`}
                        >
                          <div className="text-xs uppercase tracking-wide">
                            {format(day, "EEE")}
                          </div>
                          <div
                            className={`text-2xl font-light ${todayFlag ? "font-semibold" : ""}`}
                          >
                            {format(day, "d")}
                          </div>
                        </div>

                        {/* Milestones */}
                        <div className="flex-1 space-y-1.5 pt-0.5">
                          {dayMilestones.length === 0 ? (
                            <div className="text-sm text-muted-foreground py-1">
                              No milestones
                            </div>
                          ) : (
                            dayMilestones.map((m) => {
                              const color = getMilestoneColor(m.program_id);
                              const statusCfg =
                                MILESTONE_STATUS_CONFIG[m.status] ??
                                MILESTONE_STATUS_CONFIG.pending;
                              return (
                                <button
                                  key={m.id}
                                  onClick={() => setSelectedMilestone(m)}
                                  className="w-full text-left rounded-md border px-3 py-2 hover:bg-muted transition-colors"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div
                                        className={`h-3 w-3 rounded-full shrink-0 ${color}`}
                                      />
                                      <span
                                        className={`font-medium text-sm truncate ${
                                          m.status === "cancelled"
                                            ? "line-through text-muted-foreground"
                                            : ""
                                        }`}
                                      >
                                        {m.title}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <Badge
                                        variant="outline"
                                        className="text-xs hidden sm:flex"
                                      >
                                        {m.program_title}
                                      </Badge>
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        {statusCfg.icon}
                                        <span className="hidden sm:inline">
                                          {statusCfg.label}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty state */}
              {milestones.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                  <Calendar className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No milestones found</p>
                  <p className="text-xs mt-1">
                    {upcomingOnly
                      ? "No upcoming milestones match your filters."
                      : "No milestones have been scheduled yet."}
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <MilestoneDetailDialog
        milestone={selectedMilestone}
        programColor={selectedMilestoneColor}
        onClose={() => setSelectedMilestone(null)}
      />
    </>
  );
}
