"use client";

import { useState } from "react";
import { EventCalendar, EventDetail, EventForm } from "@/components/scheduling";
import type { ScheduledEvent } from "@/types/scheduling";

export default function SchedulingPage() {
  const [selectedEvent, setSelectedEvent] = useState<ScheduledEvent | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Scheduling</h1>
          <p className="text-muted-foreground">
            Manage events, meetings, and deadlines
          </p>
        </div>
        <EventForm />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EventCalendar onEventClick={setSelectedEvent} />
        </div>
        <div>
          {selectedEvent ? (
            <EventDetail event={selectedEvent} />
          ) : (
            <div className="rounded-lg border p-6 text-center text-muted-foreground">
              Select an event to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
