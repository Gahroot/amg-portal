import { Metadata } from "next";
import { MilestoneCalendar } from "@/components/portal/milestone-calendar";

export const metadata: Metadata = {
  title: "Milestone Calendar",
  description: "View all your program milestones across a calendar.",
};

export default function PortalCalendarPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Milestone Calendar</h1>
        <p className="text-muted-foreground text-sm mt-1">
          View all your program milestones across a calendar.
        </p>
      </div>
      <MilestoneCalendar />
    </div>
  );
}
