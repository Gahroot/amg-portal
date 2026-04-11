"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import {
  getMyCalendarEvents,
  type CalendarEvent,
} from "@/lib/api/partner-portal";
import { PROGRAM_COLORS, type ViewMode } from "./types";

export interface CalendarProgram {
  id: string;
  title: string;
}

export interface UseCalendarEventsResult {
  // state
  currentDate: Date;
  viewMode: ViewMode;
  selectedProgramId: string;
  showCompleted: boolean;
  selectedEvent: CalendarEvent | null;
  // setters
  setCurrentDate: (date: Date) => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedProgramId: (id: string) => void;
  setShowCompleted: (show: boolean) => void;
  setSelectedEvent: (event: CalendarEvent | null) => void;
  // data
  isLoading: boolean;
  allEvents: CalendarEvent[];
  filteredEvents: CalendarEvent[];
  programs: CalendarProgram[];
  programColorMap: Map<string, string>;
  dateRange: { start: Date; end: Date } | null;
  days: Date[];
  listGroups: Array<[string, CalendarEvent[]]>;
  // helpers
  getEventColor: (event: CalendarEvent) => string;
  getEventsForDay: (day: Date) => CalendarEvent[];
  navigateForward: () => void;
  navigateBack: () => void;
  goToToday: () => void;
}

export function useCalendarEvents(): UseCalendarEventsResult {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedProgramId, setSelectedProgramId] = useState<string>("all");
  const [showCompleted, setShowCompleted] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );

  const { data: allEvents = [], isLoading } = useQuery({
    queryKey: ["partner-portal", "calendar", { showCompleted }],
    queryFn: () => getMyCalendarEvents({ include_completed: showCompleted }),
  });

  const programs = useMemo<CalendarProgram[]>(() => {
    const map = new Map<string, string>();
    for (const ev of allEvents) {
      if (ev.program_id && ev.program_title) {
        map.set(ev.program_id, ev.program_title);
      }
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [allEvents]);

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

  const filteredEvents = useMemo(() => {
    if (selectedProgramId === "all") return allEvents;
    return allEvents.filter((e) => e.program_id === selectedProgramId);
  }, [allEvents, selectedProgramId]);

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

  const navigateForward = useCallback(() => {
    if (viewMode === "week") setCurrentDate((d) => addWeeks(d, 1));
    else if (viewMode === "month") setCurrentDate((d) => addMonths(d, 1));
  }, [viewMode]);

  const navigateBack = useCallback(() => {
    if (viewMode === "week") setCurrentDate((d) => subWeeks(d, 1));
    else if (viewMode === "month") setCurrentDate((d) => subMonths(d, 1));
  }, [viewMode]);

  const goToToday = useCallback(() => setCurrentDate(new Date()), []);

  const listGroups = useMemo<Array<[string, CalendarEvent[]]>>(() => {
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

  return {
    currentDate,
    viewMode,
    selectedProgramId,
    showCompleted,
    selectedEvent,
    setCurrentDate,
    setViewMode,
    setSelectedProgramId,
    setShowCompleted,
    setSelectedEvent,
    isLoading,
    allEvents,
    filteredEvents,
    programs,
    programColorMap,
    dateRange,
    days,
    listGroups,
    getEventColor,
    getEventsForDay,
    navigateForward,
    navigateBack,
    goToToday,
  };
}
