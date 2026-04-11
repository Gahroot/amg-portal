"use client";

import { format, isFuture, isPast, parseISO } from "date-fns";
import {
  CalendarIcon,
  ClipboardList,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CalendarEvent } from "@/lib/api/partner-portal";
import { DONE_STATUSES, getStatusConfig } from "./types";

export interface ListViewProps {
  listGroups: Array<[string, CalendarEvent[]]>;
  showCompleted: boolean;
  getEventColor: (event: CalendarEvent) => string;
  onSelectEvent: (event: CalendarEvent) => void;
}

export function ListView({
  listGroups,
  showCompleted,
  getEventColor,
  onSelectEvent,
}: ListViewProps) {
  if (listGroups.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <CalendarIcon className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">No deadlines found</p>
          <p className="mt-1 text-xs">
            {!showCompleted
              ? "No upcoming deadlines match your filters."
              : "No assignments or deliverables with due dates yet."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {listGroups.map(([monthLabel, monthEvents]) => (
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
                  onClick={() => onSelectEvent(ev)}
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
                            {ev.type === "deliverable" && ev.assignment_title
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
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
