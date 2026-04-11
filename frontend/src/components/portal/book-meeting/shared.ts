export const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function durationBadgeColor(minutes: number): string {
  if (minutes <= 15)
    return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
  if (minutes <= 30)
    return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
  return "bg-violet-100 text-violet-700 border-violet-200";
}

export type Step = "type" | "slot" | "agenda" | "confirm";

export const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Pending confirmation",
    className:
      "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
  confirmed: {
    label: "Confirmed",
    className:
      "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  },
  cancelled: {
    label: "Cancelled",
    className:
      "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
  },
  completed: {
    label: "Completed",
    className: "bg-muted text-muted-foreground border-border",
  },
};
