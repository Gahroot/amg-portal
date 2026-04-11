import type { CalendarEvent } from "@/lib/api/partner-portal";
import { DONE_STATUSES } from "./types";

export function buildICSContent(events: CalendarEvent[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AMG Partner Portal//Assignment Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const ev of events) {
    if (!ev.due_date) continue;
    const dtDate = ev.due_date.replace(/-/g, "");
    const uid = `${ev.type}-${ev.id}@amg-portal`;
    const summary = ev.title.replace(/[\\;,]/g, "\\$&");
    const description =
      ev.type === "deliverable"
        ? `Deliverable for: ${ev.assignment_title ?? "Unknown Assignment"}`
        : `Assignment — ${ev.program_title ?? ""}`;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${dtDate}`,
      `DTEND;VALUE=DATE:${dtDate}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `STATUS:${DONE_STATUSES.has(ev.status) ? "COMPLETED" : "CONFIRMED"}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(events: CalendarEvent[]) {
  const content = buildICSContent(events);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "amg-assignments.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
