"use client";

import { format, isPast, isToday } from "date-fns";
import { ClipboardList, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CalendarEvent } from "@/lib/api/partner-portal";
import { DONE_STATUSES, getStatusConfig } from "./types";

export interface WeekViewProps {
  days: Date[];
  getEventsForDay: (day: Date) => CalendarEvent[];
  getEventColor: (event: CalendarEvent) => string;
  onSelectEvent: (event: CalendarEvent) => void;
}

export function WeekView({
  days,
  getEventsForDay,
  getEventColor,
  onSelectEvent,
}: WeekViewProps) {
  return (
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
                      onClick={() => onSelectEvent(ev)}
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
                            <Badge variant="destructive" className="text-xs">
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
  );
}
