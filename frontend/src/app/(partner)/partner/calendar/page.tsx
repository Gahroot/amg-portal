import { Metadata } from "next";
import { AssignmentCalendar } from "@/components/partner/assignment-calendar";

export const metadata: Metadata = {
  title: "Assignment Calendar",
  description: "View all your assignment and deliverable deadlines in one place.",
};

export default function PartnerCalendarPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Assignment Calendar
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View all your assignment and deliverable deadlines in one place.
        </p>
      </div>
      <AssignmentCalendar />
    </div>
  );
}
