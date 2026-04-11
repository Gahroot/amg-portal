"use client";

import { Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useMyMeetings } from "@/hooks/use-meetings";
import { MeetingCard } from "./meeting-card";

export function MyMeetingsList() {
  const { data, isLoading } = useMyMeetings({ limit: 20 });

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">Loading meetings…</div>
    );
  }

  if (!data?.meetings.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
          No meetings yet. Book one above.
        </CardContent>
      </Card>
    );
  }

  const upcoming = data.meetings.filter(
    (m) => !["cancelled", "completed"].includes(m.status)
  );
  const past = data.meetings.filter((m) =>
    ["cancelled", "completed"].includes(m.status)
  );

  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Upcoming
          </h3>
          {upcoming.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
        </div>
      )}
      {past.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Past
          </h3>
          {past.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
        </div>
      )}
    </div>
  );
}
