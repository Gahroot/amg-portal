"use client";

import { useState } from "react";
import { CalendarPlus, ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import type { DecisionRequest } from "@/types/communication";

interface AddToCalendarButtonProps {
  decision: DecisionRequest;
  /** Compact variant for use inside list cards */
  variant?: "default" | "compact";
}

/** Format a date/time into the compact UTC string Google Calendar expects: YYYYMMDDTHHmmSSZ */
function toGoogleDateTime(dateStr: string, timeStr?: string): string {
  if (timeStr) {
    // Combine date + time and treat as UTC
    const dt = new Date(`${dateStr}T${timeStr}Z`);
    return dt
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  }
  // All-day: just YYYYMMDD
  return dateStr.replace(/-/g, "");
}

/** Build a Google Calendar "Add Event" URL */
function buildGoogleCalendarUrl(decision: DecisionRequest, portalUrl: string): string {
  const title = encodeURIComponent(`Decision Deadline: ${decision.title}`);

  let dates: string;
  if (decision.deadline_date) {
    const start = toGoogleDateTime(decision.deadline_date, decision.deadline_time ?? undefined);
    if (decision.deadline_time) {
      // Timed event — 1 hour block
      const endDt = new Date(`${decision.deadline_date}T${decision.deadline_time}Z`);
      endDt.setHours(endDt.getHours() + 1);
      const end = endDt
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
      dates = `${start}/${end}`;
    } else {
      // All-day — Google needs next day as end
      const endDate = new Date(`${decision.deadline_date}T00:00:00Z`);
      endDate.setDate(endDate.getDate() + 1);
      const end = endDate.toISOString().slice(0, 10).replace(/-/g, "");
      dates = `${start}/${end}`;
    }
  } else {
    // Fallback: today all-day
    const today = new Date();
    const fmt = (d: Date) =>
      d.toISOString().slice(0, 10).replace(/-/g, "");
    dates = `${fmt(today)}/${fmt(new Date(today.getTime() + 86400000))}`;
  }

  const descParts = [`${decision.prompt}`, "", `Review and respond: ${portalUrl}`];
  if (decision.consequence_text) {
    descParts.splice(1, 0, `Note: ${decision.consequence_text}`);
  }
  const details = encodeURIComponent(descParts.join("\n"));

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&trp=false`;
}

/** Build an Outlook Web "Add Event" URL */
function buildOutlookUrl(decision: DecisionRequest, portalUrl: string): string {
  const subject = encodeURIComponent(`Decision Deadline: ${decision.title}`);

  let startdt: string;
  let enddt: string;

  if (decision.deadline_date) {
    if (decision.deadline_time) {
      startdt = `${decision.deadline_date}T${decision.deadline_time}`;
      const endDt = new Date(`${decision.deadline_date}T${decision.deadline_time}Z`);
      endDt.setHours(endDt.getHours() + 1);
      enddt = endDt.toISOString().replace(/\.\d{3}Z$/, "");
    } else {
      startdt = decision.deadline_date;
      const endDate = new Date(`${decision.deadline_date}T00:00:00Z`);
      endDate.setDate(endDate.getDate() + 1);
      enddt = endDate.toISOString().slice(0, 10);
    }
  } else {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    startdt = today;
    enddt = tomorrow;
  }

  const bodyParts = [decision.prompt, "", `Review and respond: ${portalUrl}`];
  if (decision.consequence_text) bodyParts.splice(1, 0, `Note: ${decision.consequence_text}`);
  const body = encodeURIComponent(bodyParts.join("\n"));

  return (
    `https://outlook.live.com/calendar/0/deeplink/compose?subject=${subject}` +
    `&startdt=${encodeURIComponent(startdt)}&enddt=${encodeURIComponent(enddt)}&body=${body}`
  );
}

export function AddToCalendarButton({
  decision,
  variant = "default",
}: AddToCalendarButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const portalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/portal/decisions/${decision.id}`
      : `/portal/decisions/${decision.id}`;

  const googleUrl = buildGoogleCalendarUrl(decision, portalUrl);
  const outlookUrl = buildOutlookUrl(decision, portalUrl);

  async function handleIcalDownload() {
    setIsDownloading(true);
    try {
      const response = await api.get(`/api/v1/decisions/${decision.id}/ical`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data as BlobPart], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeTitle = decision.title.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50);
      a.download = `decision-deadline-${safeTitle}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  }

  if (variant === "compact") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
            <CalendarPlus className="h-3 w-3" />
            Add to Calendar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <CalendarMenuItems
            googleUrl={googleUrl}
            outlookUrl={outlookUrl}
            onIcalDownload={handleIcalDownload}
            isDownloading={isDownloading}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarPlus className="h-4 w-4" />
          Add to Calendar
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <CalendarMenuItems
          googleUrl={googleUrl}
          outlookUrl={outlookUrl}
          onIcalDownload={handleIcalDownload}
          isDownloading={isDownloading}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface CalendarMenuItemsProps {
  googleUrl: string;
  outlookUrl: string;
  onIcalDownload: () => void;
  isDownloading: boolean;
}

function CalendarMenuItems({
  googleUrl,
  outlookUrl,
  onIcalDownload,
  isDownloading,
}: CalendarMenuItemsProps) {
  return (
    <>
      <DropdownMenuItem asChild>
        <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
          <GoogleCalendarIcon className="mr-2 h-4 w-4" />
          Google Calendar
        </a>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <a href={outlookUrl} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
          <OutlookIcon className="mr-2 h-4 w-4" />
          Outlook Calendar
        </a>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={onIcalDownload}
        disabled={isDownloading}
        className="cursor-pointer"
      >
        <Download className="mr-2 h-4 w-4" />
        {isDownloading ? "Downloading…" : "Apple Calendar / iCal"}
      </DropdownMenuItem>
    </>
  );
}

/** Minimal Google Calendar SVG icon */
function GoogleCalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 9h18" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 14h2l1-1v4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 13h2v2h-2v2h2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Minimal Outlook SVG icon */
function OutlookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="13" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.5" cy="12" r="3" stroke="currentColor" strokeWidth="1.25" />
      <path d="M15 8h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15 12h5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}
