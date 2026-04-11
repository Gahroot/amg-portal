export const LEVEL_COLORS: Record<string, string> = {
  task: "#8b7d5e",
  milestone: "#c4a060",
  program: "var(--color-charcoal)",
  client_impact: "#8B2020",
};

export const STATUS_COLORS: Record<string, string> = {
  open: "#8B2020",
  acknowledged: "#c4a060",
  investigating: "var(--color-charcoal)",
  resolved: "#4A7A5A",
  closed: "#B8B0A0",
};

export const LEVEL_LABELS: Record<string, string> = {
  task: "Task",
  milestone: "Milestone",
  program: "Program",
  client_impact: "Client Impact",
};

export const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  investigating: "Investigating",
  resolved: "Resolved",
  closed: "Closed",
};

export type DatePreset = "30d" | "90d" | "180d" | "365d" | "custom";

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "180d", label: "Last 6 months" },
  { value: "365d", label: "Last year" },
];
