"use client";

import { useMemo } from "react";

interface PersonalizedGreetingProps {
  name: string;
  timezone?: string | null;
}

function getGreetingPeriod(timezone?: string | null): "morning" | "afternoon" | "evening" {
  const now = timezone
    ? new Date(new Date().toLocaleString("en-US", { timeZone: timezone }))
    : new Date();
  const hour = now.getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function formatGreetingDate(timezone?: string | null): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(timezone ? { timeZone: timezone } : {}),
  };
  return new Date().toLocaleDateString("en-US", options);
}

export function PersonalizedGreeting({ name, timezone }: PersonalizedGreetingProps) {
  const period = useMemo(() => getGreetingPeriod(timezone), [timezone]);
  const dateLabel = useMemo(() => formatGreetingDate(timezone), [timezone]);

  const greeting =
    period === "morning"
      ? "Good morning"
      : period === "afternoon"
        ? "Good afternoon"
        : "Good evening";

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold tracking-tight">
        {greeting}, {name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{dateLabel}</p>
    </div>
  );
}
