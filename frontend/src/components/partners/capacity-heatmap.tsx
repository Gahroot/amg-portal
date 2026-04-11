"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, parseISO } from "date-fns";
import {
  getPartnerCapacityHeatmap,
  addBlockedDate,
  removeBlockedDate,
  getPartnerBlockedDates,
} from "@/lib/api/partners";
import type { CapacityDayEntry, CapacityStatus } from "@/types/partner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Ban, CalendarX } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CapacityHeatmapProps {
  partnerId: string;
  /** If true, the partner can block/unblock dates */
  allowEditing?: boolean;
  /** Callback when a date is clicked (detail view) */
  onDateClick?: (date: string, entry: CapacityDayEntry) => void;
  className?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatusColor(status: CapacityStatus, utilisation: number): string {
  switch (status) {
    case "blocked":
      return "bg-muted-foreground text-card border-border";
    case "full":
      return "bg-red-500 text-white border-red-600";
    case "partial": {
      if (utilisation >= 0.75) return "bg-orange-400 text-white border-orange-500";
      return "bg-yellow-300 text-yellow-900 dark:text-yellow-300 border-yellow-400 dark:border-yellow-600";
    }
    case "available":
      return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function getStatusLabel(status: CapacityStatus): string {
  switch (status) {
    case "blocked": return "Blocked";
    case "full": return "Fully Booked";
    case "partial": return "Partially Booked";
    case "available": return "Available";
  }
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Component ─────────────────────────────────────────────────────────────────

export function CapacityHeatmap({
  partnerId,
  allowEditing = false,
  onDateClick,
  className,
}: CapacityHeatmapProps) {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const startDate = format(monthStart, "yyyy-MM-dd");
  const endDate = format(monthEnd, "yyyy-MM-dd");

  const { data: heatmap, isLoading } = useQuery({
    queryKey: ["partner-capacity", partnerId, startDate, endDate],
    queryFn: () => getPartnerCapacityHeatmap(partnerId, startDate, endDate),
  });

  const { data: blockedDates } = useQuery({
    queryKey: ["partner-blocked-dates", partnerId, startDate, endDate],
    queryFn: () => getPartnerBlockedDates(partnerId, startDate, endDate),
    enabled: allowEditing,
  });

  const addBlockMutation = useMutation({
    mutationFn: ({ date, reason }: { date: string; reason?: string }) =>
      addBlockedDate(partnerId, { blocked_date: date, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-capacity", partnerId] });
      queryClient.invalidateQueries({ queryKey: ["partner-blocked-dates", partnerId] });
      setBlockDialogOpen(false);
      setBlockReason("");
    },
  });

  const removeBlockMutation = useMutation({
    mutationFn: (blockedDateId: string) => removeBlockedDate(partnerId, blockedDateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-capacity", partnerId] });
      queryClient.invalidateQueries({ queryKey: ["partner-blocked-dates", partnerId] });
    },
  });

  // Build calendar grid
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = getDay(monthStart); // 0=Sun

  function getDayEntry(date: Date): CapacityDayEntry | null {
    if (!heatmap) return null;
    return (heatmap.days[format(date, "yyyy-MM-dd")] as CapacityDayEntry | undefined) ?? null;
  }

  function getBlockedDateId(dateStr: string): string | null {
    if (!blockedDates) return null;
    return blockedDates.find((b) => b.blocked_date === dateStr)?.id ?? null;
  }

  function handleDayClick(date: Date) {
    const iso = format(date, "yyyy-MM-dd");
    const entry = getDayEntry(date);
    if (entry && onDateClick) {
      onDateClick(iso, entry);
    }
    if (allowEditing) {
      setSelectedDate(iso);
    }
  }

  function handleBlockToggle() {
    if (!selectedDate) return;
    const blockedId = getBlockedDateId(selectedDate);
    if (blockedId) {
      removeBlockMutation.mutate(blockedId);
    } else {
      setBlockDialogOpen(true);
    }
  }

  const selectedEntry = selectedDate && heatmap ? heatmap.days[selectedDate] : null;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium text-sm">
          {format(currentMonth, "MMMM yyyy")}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { status: "available" as CapacityStatus, label: "Available", util: 0 },
          { status: "partial" as CapacityStatus, label: "Partial (<75%)", util: 0.5 },
          { status: "partial" as CapacityStatus, label: "Partial (≥75%)", util: 0.8 },
          { status: "full" as CapacityStatus, label: "Fully Booked", util: 1 },
          { status: "blocked" as CapacityStatus, label: "Blocked", util: 0 },
        ].map(({ status, label, util }) => (
          <span
            key={label}
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 border text-[10px]",
              getStatusColor(status, util),
            )}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      {isLoading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {/* Weekday headers */}
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">
              {d}
            </div>
          ))}

          {/* Leading blanks */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}

          {/* Days */}
          {days.map((day) => {
            const iso = format(day, "yyyy-MM-dd");
            const entry = getDayEntry(day);
            const isSelected = selectedDate === iso;
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = iso === format(new Date(), "yyyy-MM-dd");

            if (!isCurrentMonth) return <div key={iso} />;

            if (!entry) {
              return (
                <div
                  key={iso}
                  className="h-10 rounded border bg-muted/50 flex items-center justify-center text-xs text-muted-foreground"
                >
                  {format(day, "d")}
                </div>
              );
            }

            return (
              <Tooltip key={iso}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      "h-10 rounded border flex flex-col items-center justify-center text-xs transition-all",
                      "hover:ring-2 hover:ring-offset-1 hover:ring-blue-400",
                      isSelected && "ring-2 ring-offset-1 ring-blue-600",
                      isToday && "font-bold",
                      getStatusColor(entry.status, entry.utilisation),
                    )}
                  >
                    <span>{format(day, "d")}</span>
                    {entry.status !== "available" && (
                      <span className="text-[9px] leading-none opacity-80">
                        {entry.status === "blocked"
                          ? "🚫"
                          : `${entry.active_assignments}/${entry.max_concurrent}`}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="font-medium">{format(day, "EEE, MMM d")}</p>
                  <p className="text-xs">{getStatusLabel(entry.status)}</p>
                  {entry.status !== "blocked" && (
                    <p className="text-xs">
                      {entry.active_assignments}/{entry.max_concurrent} assignments
                      {" "}({Math.round(entry.utilisation * 100)}% utilisation)
                    </p>
                  )}
                  {entry.block_reason && (
                    <p className="text-xs italic">Reason: {entry.block_reason}</p>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      )}

      {/* Selected date detail panel */}
      {selectedDate && selectedEntry && (
        <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-medium text-sm">
              {format(parseISO(selectedDate), "EEEE, MMMM d")}
            </p>
            {allowEditing && (
              <Button
                size="sm"
                variant={selectedEntry.status === "blocked" ? "outline" : "secondary"}
                className="gap-1.5 text-xs h-7"
                onClick={handleBlockToggle}
                disabled={addBlockMutation.isPending || removeBlockMutation.isPending}
              >
                {selectedEntry.status === "blocked" ? (
                  <>
                    <CalendarX className="h-3.5 w-3.5" />
                    Unblock
                  </>
                ) : (
                  <>
                    <Ban className="h-3.5 w-3.5" />
                    Block this date
                  </>
                )}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={cn("text-xs", getStatusColor(selectedEntry.status as CapacityStatus, selectedEntry.utilisation))}
            >
              {getStatusLabel(selectedEntry.status as CapacityStatus)}
            </Badge>
            {selectedEntry.status !== "blocked" && (
              <span className="text-xs text-muted-foreground">
                {selectedEntry.active_assignments} of {selectedEntry.max_concurrent} slots used
                ({Math.round(selectedEntry.utilisation * 100)}%)
              </span>
            )}
            {selectedEntry.block_reason && (
              <span className="text-xs text-muted-foreground italic">
                &ldquo;{selectedEntry.block_reason}&rdquo;
              </span>
            )}
          </div>
          {selectedEntry.status !== "blocked" && (
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className={cn("h-1.5 rounded-full transition-all", {
                  "bg-emerald-500": selectedEntry.utilisation === 0,
                  "bg-yellow-400": selectedEntry.utilisation > 0 && selectedEntry.utilisation < 0.75,
                  "bg-orange-500": selectedEntry.utilisation >= 0.75 && selectedEntry.utilisation < 1,
                  "bg-red-500": selectedEntry.utilisation >= 1,
                })}
                style={{ width: `${Math.min(selectedEntry.utilisation * 100, 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Block date dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Block Date</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Blocking{" "}
              <strong>
                {selectedDate ? format(parseISO(selectedDate), "EEEE, MMMM d yyyy") : ""}
              </strong>{" "}
              will mark it as unavailable.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="reason" className="text-sm">Reason (optional)</Label>
              <Input
                id="reason"
                placeholder="e.g. Public holiday, annual leave..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                addBlockMutation.mutate({
                  date: selectedDate!,
                  reason: blockReason || undefined,
                })
              }
              disabled={addBlockMutation.isPending}
            >
              {addBlockMutation.isPending ? "Blocking..." : "Block Date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
