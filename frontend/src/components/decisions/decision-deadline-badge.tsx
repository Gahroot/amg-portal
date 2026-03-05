"use client";

import { differenceInDays, differenceInHours, format } from "date-fns";
import type { DecisionRequest } from "@/types/communication";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface DecisionDeadlineBadgeProps {
  decision: DecisionRequest;
  showIcon?: boolean;
}

export function DecisionDeadlineBadge({ decision, showIcon = true }: DecisionDeadlineBadgeProps) {
  if (!decision.deadline_date || decision.status !== "pending") {
    return null;
  }

  const deadline = new Date(decision.deadline_date);
  const now = new Date();
  const daysUntil = differenceInDays(deadline, now);
  const hoursUntil = differenceInHours(deadline, now);

  // Determine urgency
  let variant: "default" | "destructive" | "outline" | "secondary" = "default";
  let text = "";
  let Icon = Clock;

  if (daysUntil < 0) {
    // Overdue
    variant = "destructive";
    text = "Overdue";
    Icon = AlertTriangle;
  } else if (daysUntil === 0) {
    // Due today
    variant = "destructive";
    text = "Due today";
  } else if (daysUntil === 1) {
    // Due tomorrow
    variant = "destructive";
    text = "Due tomorrow";
  } else if (daysUntil <= 3) {
    // Due within 3 days
    variant = "destructive";
    text = `${daysUntil} days left`;
  } else if (daysUntil <= 7) {
    // Due within a week
    variant = "secondary";
    text = format(deadline, "MMM d");
  } else {
    // More than a week
    variant = "outline";
    text = format(deadline, "MMM d");
  }

  // For less than 24 hours, show hours
  if (hoursUntil > 0 && hoursUntil < 24 && daysUntil === 0) {
    text = `${hoursUntil}h left`;
  }

  return (
    <Badge variant={variant} className={cn("gap-1", daysUntil <= 1 && "animate-pulse")}>
      {showIcon && <Icon className="h-3 w-3" />}
      {text}
    </Badge>
  );
}
