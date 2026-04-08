"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
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
  isPast,
  isFuture,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  CalendarIcon,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  ClipboardList,
  ExternalLink,
  Download,
  List,
  LayoutGrid,
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
import { Separator } from "@/components/ui/separator";
import {
  getMyCalendarEvents,
  type CalendarEvent,
} from "@/lib/api/partner-portal";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "month" | "week" | "list";

// ─── Status configurations ────────────────────────────────────────────────────

const ASSIGNMENT_STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; dotColor: string; textColor: string }
> = {
  draft: {
    label: "Draft",
    icon: <Circle className="h-3.5 w-3.5 text-muted-foreground" />,
    dotColor: "bg-muted-foreground",
    textColor: "text-muted-foreground",
  },
  dispatched: {
    label: "Dispatched",
    icon: <Clock className="h-3.5 w-3.5 text-blue-500" />,
    dotColor: "bg-blue-500",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  accepted: {
    label: "Accepted",
    icon: <Clock className="h-3.5 w-3.5 text-amber-500" />,
    dotColor: "bg-amber-500",
    textColor: "text-amber-600 dark:text-amber-400",
  },
  in_progress: {
    label: "In Progress",
    icon: <Clock className="h-3.5 w-3.5 text-amber-500" />,
    dotColor: "bg-amber-500",
    textColor: "text-amber-600 dark:text-amber-400",
  },
  completed: {
    label: "Completed",
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />,
    dotColor: "bg-green-500",
    textColor: "text-green-600 dark:text-green-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: <XCircle className="h-3.5 w-3.5 text-muted-foreground" />,
    dotColor: "bg-muted-foreground/40",
    textColor: "text-muted-foreground",
  },
};

const DELIVERABLE_STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; dotColor: string; textColor: string }
> = {
  pending: {
    label: "Pending",
    icon: <Circle className="h-3.5 w-3.5 text-muted-foreground" />,
    dotColor: "bg-muted-foreground",
    textColor: "text-muted-foreground",
  },
  submitted: {
    label: "Submitted",
    icon: <Clock className="h-3.5 w-3.5 text-blue-500" />,
    dotColor: "bg-blue-500",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  under_review: {
    label: "Under Review",
    icon: <AlertCircle className="h-3.5 w-3.5 text-amber-500" />,
    dotColor: "bg-amber-500",
    textColor: "text-amber-600 dark:text-amber-400",
  },
  approved: {
    label: "Approved",
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />,
    dotColor: "bg-green-500",
    textColor: "text-green-600 dark:text-green-400",
  },
  returned: {
    label: "Returned",
    icon: <AlertCircle className="h-3.5 w-3.5 text-orange-500" />,
    dotColor: "bg-orange-500",
    textColor: "text-orange-600 dark:text-orange-400",
  },
  rejected: {
    label: "Rejected",
    icon: <XCircle className="h-3.5 w-3.5 text-red-500" />,
    dotColor: "bg-red-500",
    textColor: "text-red-600 dark:text-red-400",
  },
};

function getStatusConfig(event: CalendarEvent) {
  if (event.type === "assignment") {
    return (
      ASSIGNMENT_STATUS_CONFIG[event.status] ?? ASSIGNMENT_STATUS_CONFIG.draft
    );
  }
  return (
    DELIVERABLE_STATUS_CONFIG[event.status] ?? DELIVERABLE_STATUS_CONFIG.pending
  );
}

// Consistent program colors assigned by index
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

const DONE_STATUSES = new Set([
  "completed",
  "approved",
  "cancelled",
  "rejected",
]);

// ─── ICS export utility ───────────────────────────────────────────────────────

function buildICSContent(events: CalendarEvent[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AMG Partner Portal//Assignment Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const ev of events) {
    if (!ev.due_date) continue;
    const dtDate = ev.due_date.replace(/-/g, "");
    const uid = `${ev.type}-${ev.id}@amg-portal`;
    const summary = ev.title.replace(/[\\;,]/g, "\\$&");
    const description =
      ev.type === "deliverable"
        ? `Deliverable for: ${ev.assignment_title ?? "Unknown Assignment"}`
        : `Assignment — ${ev.program_title ?? ""}`;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${dtDate}`,
      `DTEND;VALUE=DATE:${dtDate}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `STATUS:${DONE_STATUSES.has(ev.status) ? "COMPLETED" : "CONFIRMED"}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function downloadICS(events: CalendarEvent[]) {
  const content = buildICSContent(events);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "amg-assignments.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Detail Dialog ─────────────────────────────────────────────────────────────

interface EventDetailDialogProps {
  event: CalendarEvent | null;
  programColor: string;
  onClose: () => void;
}

function EventDetailDialog({
  event,
  programColor,
  onClose,
}: EventDetailDialogProps) {
  if (!event) return null;

  const statusCfg = getStatusConfig(event);
  const isOverdue =
    event.due_date &&
    isPast(parseISO(event.due_date)) &&
    !DONE_STATUSES.has(event.status);

  return (
    <Dialog open={!!event} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2">
            {event.type === "assignment" ? (
              <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {event.type === "assignment"
                ? "Assignment"
                : `Deliverable · ${event.deliverable_type ?? ""}`}
            </span>
          </div>
          <DialogTitle className="pr-6 text-base leading-snug">
            {event.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Program */}
          {event.program_title && (
            <div className="flex items-center gap-2">
              <div
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${programColor}`}
              />
              <span className="text-sm text-muted-foreground">
                {event.program_title}
              </span>
            </div>
          )}

          {/* For deliverables: show parent assignment */}
          {event.type === "deliverable" && event.assignment_title && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5 shrink-0" />
              <span>Assignment: {event.assignment_title}</span>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-2">
            {statusCfg.icon}
            <span className={`text-sm font-medium ${statusCfg.textColor}`}>
              {statusCfg.label}
            </span>
            {isOverdue && (
              <Badge variant="destructive" className="ml-1 text-xs">
                Overdue
              </Badge>
            )}
          </div>

          {/* Due date */}
          {event.due_date && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>Due {format(parseISO(event.due_date), "MMMM d, yyyy")}</span>
            </div>
          )}

          <Separator />

          {/* Navigation links */}
          <div className="flex gap-2">
            {event.type === "assignment" ? (
              <Link
                href={`/partner/assignments/${event.assignment_id}`}
                onClick={onClose}
              >
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  View Assignment
                </Button>
              </Link>
            ) : (
              <>
                <Link
                  href={`/partner/deliverables/${event.id}`}
                  onClick={onClose}
                >
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    View Deliverable
                  </Button>
                </Link>
                <Link
                  href={`/partner/assignments/${event.assignment_id}`}
                  onClick={onClose}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    View Assignment
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AssignmentCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedProgramId, setSelectedProgramId] = useState<string>("all");
  const [showCompleted, setShowCompleted] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );

  // Fetch all calendar events
  const { data: allEvents = [], isLoading } = useQuery({
    queryKey: ["partner-portal", "calendar", { showCompleted }],
    queryFn: () => getMyCalendarEvents({ include_completed: showCompleted }),
  });

  // Build unique programs list from events
  const programs = useMemo(() => {
    const map = new Map<string, string>();
    for (const ev of allEvents) {
      if (ev.program_id && ev.program_title) {
        map.set(ev.program_id, ev.program_title);
      }
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [allEvents]);

  // Program color map
  const programColorMap = useMemo(() => {
    const map = new Map<string, string>();
    programs.forEach((p, i) => {
      map.set(p.id, PROGRAM_COLORS[i % PROGRAM_COLORS.length]);
    });
    return map;
  }, [programs]);

  const getEventColor = useCallback(
    (event: CalendarEvent) =>
      (event.program_id && programColorMap.get(event.program_id)) ||
      "bg-muted-foreground",
    [programColorMap]
  );

  // Filter events by program
  const filteredEvents = useMemo(() => {
    if (selectedProgramId === "all") return allEvents;
    return allEvents.filter((e) => e.program_id === selectedProgramId);
  }, [allEvents, selectedProgramId]);

  // Date range for current view
  const dateRange = useMemo(() => {
    if (viewMode === "week") {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      };
    }
    if (viewMode === "month") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return {
        start: startOfWeek(monthStart, { weekStartsOn: 1 }),
        end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
      };
    }
    return null;
  }, [currentDate, viewMode]);

  const days = useMemo(() => {
    if (!dateRange) return [];
    return eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  }, [dateRange]);

  const getEventsForDay = useCallback(
    (day: Date) =>
      filteredEvents.filter(
        (e) =>
          e.due_date &&
          format(parseISO(e.due_date), "yyyy-MM-dd") ===
            format(day, "yyyy-MM-dd")
      ),
    [filteredEvents]
  );

  const navigateForward = () => {
    if (viewMode === "week") setCurrentDate((d) => addWeeks(d, 1));
    else if (viewMode === "month") setCurrentDate((d) => addMonths(d, 1));
  };

  const navigateBack = () => {
    if (viewMode === "week") setCurrentDate((d) => subWeeks(d, 1));
    else if (viewMode === "month") setCurrentDate((d) => subMonths(d, 1));
  };

  const selectedEventColor = selectedEvent
    ? getEventColor(selectedEvent)
    : "bg-muted-foreground";

  // List view: group by month
  const listGroups = useMemo(() => {
    if (viewMode !== "list") return [];
    const groups = new Map<string, CalendarEvent[]>();
    for (const ev of filteredEvents) {
      if (!ev.due_date) continue;
      const key = format(parseISO(ev.due_date), "MMMM yyyy");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ev);
    }
    return Array.from(groups.entries());
  }, [filteredEvents, viewMode]);

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {/* Title */}
            <CardTitle>
              {viewMode === "week" && dateRange
                ? `Week of ${format(dateRange.start, "MMM d, yyyy")}`
                : viewMode === "month"
                  ? format(currentDate, "MMMM yyyy")
                  : "All Deadlines"}
            </CardTitle>

            <div className="flex flex-wrap items-center gap-2">
              {/* View toggle */}
              <div className="flex rounded-md border">
                <Button
                  variant={viewMode === "month" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("month")}
                  className="rounded-r-none gap-1.5"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Month
                </Button>
                <Button
                  variant={viewMode === "week" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("week")}
                  className="rounded-none gap-1.5"
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Week
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="rounded-l-none gap-1.5"
                >
                  <List className="h-3.5 w-3.5" />
                  List
                </Button>
              </div>

              {/* Navigation (month/week only) */}
              {viewMode !== "list" && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={navigateBack}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentDate(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={navigateForward}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}

              {/* Export */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => downloadICS(filteredEvents)}
                disabled={filteredEvents.length === 0}
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            {/* Program filter */}
            <Select
              value={selectedProgramId}
              onValueChange={setSelectedProgramId}
            >
              <SelectTrigger className="h-8 w-48 text-sm">
                <SelectValue placeholder="All programs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All programs</SelectItem>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${programColorMap.get(p.id) ?? "bg-muted-foreground"}`}
                      />
                      {p.title}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Show completed toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="show-completed"
                checked={showCompleted}
                onCheckedChange={setShowCompleted}
              />
              <Label
                htmlFor="show-completed"
                className="cursor-pointer text-sm"
              >
                Show completed
              </Label>
            </div>

            {/* Program legend */}
            {selectedProgramId === "all" && programs.length > 0 && (
              <div className="ml-auto flex flex-wrap items-center gap-3">
                {programs.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${programColorMap.get(p.id) ?? "bg-muted-foreground"}`}
                    />
                    <span className="max-w-[120px] truncate text-xs text-muted-foreground">
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

          {/* Type legend */}
          <div className="flex items-center gap-4 pt-1">
            <div className="flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Assignment deadline
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Deliverable deadline
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Loading calendar…
            </div>
          ) : (
            <>
              {/* ── Month View ── */}
              {viewMode === "month" && (
                <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-muted">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                    (day) => (
                      <div
                        key={day}
                        className="bg-background p-2 text-center text-xs font-medium text-muted-foreground"
                      >
                        {day}
                      </div>
                    )
                  )}
                  {days.map((day) => {
                    const dayEvents = getEventsForDay(day);
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const todayFlag = isToday(day);
                    return (
                      <div
                        key={day.toISOString()}
                        className={[
                          "min-h-[90px] bg-background p-2",
                          !isCurrentMonth ? "opacity-40" : "",
                          todayFlag ? "ring-2 ring-inset ring-primary" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <div
                          className={`mb-1 text-xs font-medium ${
                            todayFlag ? "font-bold text-primary" : ""
                          }`}
                        >
                          {format(day, "d")}
                        </div>
                        <div className="space-y-0.5">
                          {dayEvents.slice(0, 3).map((ev) => {
                            const color = getEventColor(ev);
                            const isOverdue =
                              isPast(day) && !DONE_STATUSES.has(ev.status);
                            return (
                              <button
                                key={`${ev.type}-${ev.id}`}
                                onClick={() => setSelectedEvent(ev)}
                                className="w-full rounded-sm text-left transition-colors hover:bg-muted"
                              >
                                <div className="flex items-center gap-1 px-1 py-0.5">
                                  <div
                                    className={`h-2 w-2 shrink-0 rounded-full ${
                                      isOverdue ? "bg-red-500" : color
                                    }`}
                                  />
                                  <span
                                    className={`truncate text-xs leading-tight ${
                                      DONE_STATUSES.has(ev.status)
                                        ? "text-muted-foreground line-through"
                                        : isOverdue
                                          ? "font-medium text-red-600 dark:text-red-400"
                                          : ""
                                    }`}
                                  >
                                    {ev.title}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                          {dayEvents.length > 3 && (
                            <div className="px-1 text-xs text-muted-foreground">
                              +{dayEvents.length - 3} more
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
                    const dayEvents = getEventsForDay(day);
                    const todayFlag = isToday(day);
                    return (
                      <div
                        key={day.toISOString()}
                        className="flex gap-4 border-b pb-3 last:border-0"
                      >
                        <div
                          className={`w-16 shrink-0 text-sm font-medium ${
                            todayFlag ? "text-primary" : ""
                          }`}
                        >
                          <div className="text-xs uppercase tracking-wide">
                            {format(day, "EEE")}
                          </div>
                          <div
                            className={`text-2xl font-light ${
                              todayFlag ? "font-semibold" : ""
                            }`}
                          >
                            {format(day, "d")}
                          </div>
                        </div>

                        <div className="flex-1 space-y-1.5 pt-0.5">
                          {dayEvents.length === 0 ? (
                            <div className="py-1 text-sm text-muted-foreground">
                              No deadlines
                            </div>
                          ) : (
                            dayEvents.map((ev) => {
                              const color = getEventColor(ev);
                              const statusCfg = getStatusConfig(ev);
                              const isOverdue =
                                isPast(day) && !DONE_STATUSES.has(ev.status);
                              return (
                                <button
                                  key={`${ev.type}-${ev.id}`}
                                  onClick={() => setSelectedEvent(ev)}
                                  className="w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <div
                                        className={`h-3 w-3 shrink-0 rounded-full ${
                                          isOverdue ? "bg-red-500" : color
                                        }`}
                                      />
                                      <div className="flex min-w-0 items-center gap-1.5">
                                        {ev.type === "deliverable" ? (
                                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        ) : (
                                          <ClipboardList className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        )}
                                        <span
                                          className={`truncate text-sm font-medium ${
                                            DONE_STATUSES.has(ev.status)
                                              ? "text-muted-foreground line-through"
                                              : isOverdue
                                                ? "text-red-600 dark:text-red-400"
                                                : ""
                                          }`}
                                        >
                                          {ev.title}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                      {ev.program_title && (
                                        <Badge
                                          variant="outline"
                                          className="hidden text-xs sm:flex"
                                        >
                                          {ev.program_title}
                                        </Badge>
                                      )}
                                      {isOverdue && (
                                        <Badge
                                          variant="destructive"
                                          className="text-xs"
                                        >
                                          Overdue
                                        </Badge>
                                      )}
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

              {/* ── List View ── */}
              {viewMode === "list" && (
                <div className="space-y-6">
                  {listGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                      <CalendarIcon className="mb-3 h-10 w-10 opacity-30" />
                      <p className="text-sm font-medium">No deadlines found</p>
                      <p className="mt-1 text-xs">
                        {!showCompleted
                          ? "No upcoming deadlines match your filters."
                          : "No assignments or deliverables with due dates yet."}
                      </p>
                    </div>
                  ) : (
                    listGroups.map(([monthLabel, monthEvents]) => (
                      <div key={monthLabel}>
                        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          {monthLabel}
                        </h3>
                        <div className="space-y-1.5">
                          {monthEvents.map((ev) => {
                            const color = getEventColor(ev);
                            const statusCfg = getStatusConfig(ev);
                            const parsedDate = parseISO(ev.due_date);
                            const isOverdue =
                              isPast(parsedDate) && !DONE_STATUSES.has(ev.status);
                            const isFutureDate = isFuture(parsedDate);
                            return (
                              <button
                                key={`${ev.type}-${ev.id}`}
                                onClick={() => setSelectedEvent(ev)}
                                className="w-full rounded-md border px-4 py-3 text-left transition-colors hover:bg-muted"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <div
                                      className={`h-3 w-3 shrink-0 rounded-full ${
                                        isOverdue ? "bg-red-500" : color
                                      }`}
                                    />
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        {ev.type === "deliverable" ? (
                                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        ) : (
                                          <ClipboardList className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        )}
                                        <span
                                          className={`truncate text-sm font-medium ${
                                            DONE_STATUSES.has(ev.status)
                                              ? "text-muted-foreground line-through"
                                              : isOverdue
                                                ? "text-red-600 dark:text-red-400"
                                                : ""
                                          }`}
                                        >
                                          {ev.title}
                                        </span>
                                      </div>
                                      {ev.program_title && (
                                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                          {ev.program_title}
                                          {ev.type === "deliverable" &&
                                          ev.assignment_title
                                            ? ` · ${ev.assignment_title}`
                                            : ""}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex shrink-0 items-center gap-2">
                                    <span
                                      className={`text-xs ${
                                        isOverdue
                                          ? "font-semibold text-red-600 dark:text-red-400"
                                          : isFutureDate
                                            ? "text-muted-foreground"
                                            : "text-muted-foreground"
                                      }`}
                                    >
                                      {format(parsedDate, "MMM d")}
                                    </span>
                                    {isOverdue && (
                                      <Badge
                                        variant="destructive"
                                        className="text-xs"
                                      >
                                        Overdue
                                      </Badge>
                                    )}
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
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Empty state for month/week */}
              {viewMode !== "list" &&
                filteredEvents.length === 0 &&
                !isLoading && (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                    <CalendarIcon className="mb-3 h-10 w-10 opacity-30" />
                    <p className="text-sm font-medium">No deadlines found</p>
                    <p className="mt-1 text-xs">
                      {!showCompleted
                        ? "No upcoming deadlines match your filters."
                        : "No assignments or deliverables with due dates yet."}
                    </p>
                  </div>
                )}
            </>
          )}
        </CardContent>
      </Card>

      <EventDetailDialog
        event={selectedEvent}
        programColor={selectedEventColor}
        onClose={() => setSelectedEvent(null)}
      />
    </>
  );
}
