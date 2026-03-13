"use client";

import { CheckCircle, Clock, XCircle, AlertTriangle } from "lucide-react";
import type { KYCVerification } from "@/types/kyc-verification";

interface TimelineEvent {
  label: string;
  date: string | null;
  icon: React.ElementType;
  iconColor: string;
  active: boolean;
}

function buildTimeline(verification: KYCVerification): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      label: "Document Uploaded",
      date: verification.created_at,
      icon: Clock,
      iconColor: "text-blue-500",
      active: true,
    },
  ];

  if (verification.status === "verified") {
    events.push({
      label: "Verified",
      date: verification.verified_at,
      icon: CheckCircle,
      iconColor: "text-green-600",
      active: true,
    });
  } else if (verification.status === "rejected") {
    events.push({
      label: "Rejected",
      date: verification.verified_at,
      icon: XCircle,
      iconColor: "text-red-600",
      active: true,
    });
  } else if (verification.status === "expired") {
    events.push({
      label: "Expired",
      date: verification.expiry_date,
      icon: AlertTriangle,
      iconColor: "text-amber-600",
      active: true,
    });
  } else {
    events.push({
      label: "Awaiting Review",
      date: null,
      icon: Clock,
      iconColor: "text-muted-foreground",
      active: false,
    });
  }

  return events;
}

interface VerificationTimelineProps {
  verification: KYCVerification;
}

export function VerificationTimeline({ verification }: VerificationTimelineProps) {
  const events = buildTimeline(verification);

  return (
    <div className="relative space-y-6 pl-8">
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
      {events.map((event, i) => {
        const Icon = event.icon;
        return (
          <div key={i} className="relative flex items-start gap-3">
            <div
              className={`absolute -left-8 flex h-8 w-8 items-center justify-center rounded-full bg-background border ${
                event.active ? "border-border" : "border-dashed border-muted-foreground/40"
              }`}
            >
              <Icon className={`h-4 w-4 ${event.iconColor}`} />
            </div>
            <div className="pt-1">
              <p
                className={`text-sm font-medium ${
                  event.active ? "" : "text-muted-foreground"
                }`}
              >
                {event.label}
              </p>
              {event.date && (
                <p className="text-xs text-muted-foreground">
                  {new Date(event.date).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
