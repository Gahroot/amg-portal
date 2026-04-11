"use client";

import { format, isPast, isSameMonth, isToday } from "date-fns";
import type { CalendarEvent } from "@/lib/api/partner-portal";
import { DONE_STATUSES } from "./types";

export interface MonthViewProps {
  days: Date[];
  currentDate: Date;
  getEventsForDay: (day: Date) => CalendarEvent[];
  getEventColor: (event: CalendarEvent) => string;
  onSelectEvent: (event: CalendarEvent) => void;
}

export function MonthView({
  days,
  currentDate,
  getEventsForDay,
  getEventColor,
  onSelectEvent,
}: MonthViewProps) {
  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-muted">
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
        <div
          key={day}
          className="bg-background p-2 text-center text-xs font-medium text-muted-foreground"
        >
          {day}
        </div>
      ))}
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
                    onClick={() => onSelectEvent(ev)}
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
  );
}
