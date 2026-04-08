"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface SLAClockProps {
  startedAt: string;
  slaHours: number;
  respondedAt?: string;
  className?: string;
}

export function SLAClock({
  startedAt,
  slaHours,
  respondedAt,
  className = "",
}: SLAClockProps) {
  const [timeDisplay, setTimeDisplay] = useState<React.ReactNode>("");
  const [colorClass, setColorClass] = useState("text-green-600 dark:text-green-400");

  useEffect(() => {
    const updateDisplay = () => {
      const start = new Date(startedAt);
      const now = new Date();
      const end = respondedAt ? new Date(respondedAt) : null;
      const reference = end || now;

      const elapsedMs = reference.getTime() - start.getTime();
      const elapsedHours = elapsedMs / (1000 * 60 * 60);
      const remainingMs = slaHours * 60 * 60 * 1000 - elapsedMs;

      if (end) {
        // Responded - show response time
        const hours = Math.floor(elapsedHours);
        const minutes = Math.floor((elapsedHours % 1) * 60);
        setTimeDisplay(
          <span className="text-muted-foreground">
            Responded in {hours}h {minutes}m
          </span>,
        );
        setColorClass(
          elapsedHours > slaHours ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
        );
        return;
      }

      if (remainingMs <= 0) {
        // Breached
        const overdueHours = Math.abs(elapsedHours - slaHours);
        const hours = Math.floor(overdueHours);
        const minutes = Math.floor((overdueHours % 1) * 60);
        setTimeDisplay(
          <span className="text-red-600 dark:text-red-400 font-semibold">
            OVERDUE by {hours}h {minutes}m
          </span>,
        );
        setColorClass("text-red-600 dark:text-red-400");
      } else {
        const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const remainingMinutes = Math.floor(
          (remainingMs % (1000 * 60 * 60)) / (1000 * 60)
        );
        const percentage = (elapsedHours / slaHours) * 100;

        setTimeDisplay(
          <span>
            {remainingHours}h {remainingMinutes}m remaining
          </span>
        );

        if (percentage >= 100) {
          setColorClass("text-red-600 dark:text-red-400");
        } else if (percentage >= 80) {
          setColorClass("text-amber-600 dark:text-amber-400");
        } else {
          setColorClass("text-green-600 dark:text-green-400");
        }
      }
    };

    updateDisplay();
    const interval = setInterval(updateDisplay, 60 * 1000); // Update every minute

    return () => clearInterval(interval);
  }, [startedAt, slaHours, respondedAt]);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Clock className={`h-4 w-4 ${colorClass}`} />
      <span className={`text-sm font-medium ${colorClass}`}>{timeDisplay}</span>
    </div>
  );
}
