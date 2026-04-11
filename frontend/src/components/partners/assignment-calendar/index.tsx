"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CalendarToolbar } from "./calendar-toolbar";
import { EventDetailDialog } from "./event-detail-dialog";
import { downloadICS } from "./ics";
import { ListView } from "./list-view";
import { MonthView } from "./month-view";
import { useCalendarEvents } from "./use-calendar-events";
import { WeekView } from "./week-view";

export function AssignmentCalendar() {
  const calendar = useCalendarEvents();
  const {
    currentDate,
    viewMode,
    setViewMode,
    selectedProgramId,
    setSelectedProgramId,
    showCompleted,
    setShowCompleted,
    selectedEvent,
    setSelectedEvent,
    isLoading,
    filteredEvents,
    programs,
    programColorMap,
    dateRange,
    days,
    listGroups,
    getEventColor,
    getEventsForDay,
    navigateBack,
    navigateForward,
    goToToday,
  } = calendar;

  const selectedEventColor = selectedEvent
    ? getEventColor(selectedEvent)
    : "bg-muted-foreground";

  const title =
    viewMode === "week" && dateRange
      ? `Week of ${format(dateRange.start, "MMM d, yyyy")}`
      : viewMode === "month"
        ? format(currentDate, "MMMM yyyy")
        : "All Deadlines";

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <CardTitle>{title}</CardTitle>
            <CalendarToolbar
              viewMode={viewMode}
              setViewMode={setViewMode}
              navigateBack={navigateBack}
              navigateForward={navigateForward}
              goToToday={goToToday}
              onExport={() => downloadICS(filteredEvents)}
              exportDisabled={filteredEvents.length === 0}
              selectedProgramId={selectedProgramId}
              setSelectedProgramId={setSelectedProgramId}
              showCompleted={showCompleted}
              setShowCompleted={setShowCompleted}
              programs={programs}
              programColorMap={programColorMap}
            />
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Loading calendar…
            </div>
          ) : (
            <>
              {viewMode === "month" && (
                <MonthView
                  days={days}
                  currentDate={currentDate}
                  getEventsForDay={getEventsForDay}
                  getEventColor={getEventColor}
                  onSelectEvent={setSelectedEvent}
                />
              )}

              {viewMode === "week" && (
                <WeekView
                  days={days}
                  getEventsForDay={getEventsForDay}
                  getEventColor={getEventColor}
                  onSelectEvent={setSelectedEvent}
                />
              )}

              {viewMode === "list" && (
                <ListView
                  listGroups={listGroups}
                  showCompleted={showCompleted}
                  getEventColor={getEventColor}
                  onSelectEvent={setSelectedEvent}
                />
              )}

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
