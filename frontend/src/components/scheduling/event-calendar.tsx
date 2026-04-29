"use client";

import { useState, useMemo } from "react";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isWithinInterval,
  parseISO,
  format,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMySchedule } from "@/hooks/use-scheduling";
import type { ScheduledEvent } from "@/types/scheduling";

type ViewMode = "week" | "month";

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500",
  confirmed: "bg-green-500",
  cancelled: "bg-red-500",
  completed: "bg-muted-foreground",
};

interface EventCalendarProps {
  onEventClick?: (event: ScheduledEvent) => void;
}

export function EventCalendar({ onEventClick }: EventCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");

  const dateRange = useMemo(() => {
    if (viewMode === "week") {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      };
    }
    return {
      start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }),
    };
  }, [currentDate, viewMode]);

  const { data } = useMySchedule(
    dateRange.start.toISOString(),
    dateRange.end.toISOString()
  );

  const events = data?.events || [];

  const days = eachDayOfInterval({
    start: dateRange.start,
    end: dateRange.end,
  });

  const getEventsForDay = (day: Date) =>
    events.filter((e) => {
      const start = parseISO(e.start_time);
      const end = parseISO(e.end_time);
      return (
        isSameDay(start, day) ||
        isSameDay(end, day) ||
        isWithinInterval(day, { start, end })
      );
    });

  const navigateForward = () => {
    if (viewMode === "week") {
      setCurrentDate((d) => addWeeks(d, 1));
    } else {
      setCurrentDate((d) => addMonths(d, 1));
    }
  };

  const navigateBack = () => {
    if (viewMode === "week") {
      setCurrentDate((d) => subWeeks(d, 1));
    } else {
      setCurrentDate((d) => subMonths(d, 1));
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{format(currentDate, viewMode === "week" ? "'Week of' MMM d, yyyy" : "MMMM yyyy")}</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border">
              <Button
                variant={viewMode === "week" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("week")}
                className="rounded-r-none"
              >
                Week
              </Button>
              <Button
                variant={viewMode === "month" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("month")}
                className="rounded-l-none"
              >
                Month
              </Button>
            </div>
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
      </CardHeader>
      <CardContent>
        {viewMode === "month" && (
          <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
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
              return (
                <div
                  key={day.toISOString()}
                  className={`bg-background p-2 min-h-[100px] ${
                    !isSameMonth(day, currentDate) ? "opacity-50" : ""
                  } ${isSameDay(day, new Date()) ? "ring-2 ring-primary ring-inset" : ""}`}
                >
                  <div className="text-xs font-medium mb-1">
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <button
                        key={event.id}
                        onClick={() => onEventClick?.(event)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center gap-1">
                          <div
                            className={`h-2 w-2 rounded-full shrink-0 ${statusColors[event.status] || "bg-muted-foreground"}`}
                          />
                          <span className="text-xs truncate">
                            {format(new Date(event.start_time), "HH:mm")}{" "}
                            {event.title}
                          </span>
                        </div>
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {viewMode === "week" && (
          <div className="space-y-2">
            {days.map((day) => {
              const dayEvents = getEventsForDay(day);
              return (
                <div key={day.toISOString()} className="flex gap-4 border-b pb-2">
                  <div
                    className={`w-20 shrink-0 text-sm font-medium ${
                      isSameDay(day, new Date()) ? "text-primary" : ""
                    }`}
                  >
                    <div>{format(day, "EEE")}</div>
                    <div className="text-lg">{format(day, "d")}</div>
                  </div>
                  <div className="flex-1 space-y-1">
                    {dayEvents.length === 0 && (
                      <div className="text-sm text-muted-foreground py-2">
                        No events
                      </div>
                    )}
                    {dayEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => onEventClick?.(event)}
                        className="w-full text-left rounded-md border p-2 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-3 w-3 rounded-full ${statusColors[event.status] || "bg-muted-foreground"}`}
                            />
                            <span className="font-medium text-sm">
                              {event.title}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {event.event_type.replace("_", " ")}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 ml-5">
                          {format(new Date(event.start_time), "HH:mm")} –{" "}
                          {format(new Date(event.end_time), "HH:mm")}
                          {event.location && ` · ${event.location}`}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
