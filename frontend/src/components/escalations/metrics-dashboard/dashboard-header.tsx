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
import {
  DATE_PRESETS,
  LEVEL_LABELS,
  STATUS_LABELS,
  type DatePreset,
} from "./constants";

interface DashboardHeaderProps {
  preset: DatePreset;
  onPresetChange: (p: DatePreset) => void;
  levelFilter: string;
  onLevelFilterChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  onRefresh: () => void;
  isFetching: boolean;
  canExport: boolean;
  onExport: () => void;
}

export function DashboardHeader({
  preset,
  onPresetChange,
  levelFilter,
  onLevelFilterChange,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  isFetching,
  canExport,
  onExport,
}: DashboardHeaderProps) {
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

        <Select value={levelFilter} onValueChange={onLevelFilterChange}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {Object.entries(LEVEL_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[145px] h-8 text-xs">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isFetching}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`}
          />
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
