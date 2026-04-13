"use client";

import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Constants ─────────────────────────────────────────────────────────────────

export type DatePreset = "30d" | "90d" | "180d" | "365d" | "custom";

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "180d", label: "Last 6 months" },
  { value: "365d", label: "Last year" },
];

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

// ── Props ─────────────────────────────────────────────────────────────────────

interface MetricsFilterPanelProps {
  preset: DatePreset;
  levelFilter: string;
  statusFilter: string;
  isFetching: boolean;
  canExport: boolean;
  onPresetChange: (preset: DatePreset) => void;
  onLevelChange: (level: string) => void;
  onStatusChange: (status: string) => void;
  onRefresh: () => void;
  onExport: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MetricsFilterPanel({
  preset,
  levelFilter,
  statusFilter,
  isFetching,
  canExport,
  onPresetChange,
  onLevelChange,
  onStatusChange,
  onRefresh,
  onExport,
}: MetricsFilterPanelProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          Escalation Metrics
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Resolution time, frequency, and trend analysis
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Date preset */}
        <div className="flex rounded-md border overflow-hidden">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => onPresetChange(p.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                preset === p.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Level filter */}
        <Select value={levelFilter} onValueChange={onLevelChange}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {Object.entries(LEVEL_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[145px] h-8 text-xs">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isFetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>

        {canExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-3.5 w-3.5 mr-1" />
            Export
          </Button>
        )}
      </div>
    </div>
  );
}
