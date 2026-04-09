"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ZoomIn,
  ZoomOut,
  Download,
  Filter,
  CalendarDays,
  CalendarRange,
  Calendar,
} from "lucide-react";

export type ZoomLevel = "day" | "week" | "month";

export interface GanttFilters {
  hideCompleted: boolean;
  showOnlyCritical: boolean;
  hideTasks: boolean;
}

interface GanttToolbarProps {
  zoom: ZoomLevel;
  onZoomChange: (zoom: ZoomLevel) => void;
  filters: GanttFilters;
  onFiltersChange: (filters: GanttFilters) => void;
  onExport: () => void;
  isExporting?: boolean;
}

const ZOOM_LEVELS: { value: ZoomLevel; label: string; icon: ReactNode }[] = [
  { value: "day", label: "Day", icon: <CalendarDays className="h-3.5 w-3.5" /> },
  { value: "week", label: "Week", icon: <CalendarRange className="h-3.5 w-3.5" /> },
  { value: "month", label: "Month", icon: <Calendar className="h-3.5 w-3.5" /> },
];

export function GanttToolbar({
  zoom,
  onZoomChange,
  filters,
  onFiltersChange,
  onExport,
  isExporting = false,
}: GanttToolbarProps) {
  const zoomIndex = ZOOM_LEVELS.findIndex((z) => z.value === zoom);

  const handleZoomIn = () => {
    if (zoomIndex > 0) onZoomChange(ZOOM_LEVELS[zoomIndex - 1].value);
  };

  const handleZoomOut = () => {
    if (zoomIndex < ZOOM_LEVELS.length - 1) onZoomChange(ZOOM_LEVELS[zoomIndex + 1].value);
  };

  const activeFiltersCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-2.5">
      {/* Left: Zoom controls */}
      <div className="flex items-center gap-1">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Zoom</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleZoomIn}
          disabled={zoomIndex === 0}
          title="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>

        <div className="flex rounded-md border">
          {ZOOM_LEVELS.map((level, i) => (
            <button
              key={level.value}
              onClick={() => onZoomChange(level.value)}
              className={[
                "flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors",
                i === 0 ? "rounded-l-md" : "",
                i === ZOOM_LEVELS.length - 1 ? "rounded-r-md" : "",
                i > 0 ? "border-l" : "",
                zoom === level.value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {level.icon}
              {level.label}
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleZoomOut}
          disabled={zoomIndex === ZOOM_LEVELS.length - 1}
          title="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Center: Legend */}
      <div className="hidden items-center gap-3 sm:flex">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-6 rounded-sm bg-blue-500" />
          <span className="text-xs text-muted-foreground">In Progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-6 rounded-sm bg-emerald-500" />
          <span className="text-xs text-muted-foreground">Completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-6 rounded-sm bg-muted-foreground" />
          <span className="text-xs text-muted-foreground">Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-6 rounded-sm bg-red-500" />
          <span className="text-xs text-muted-foreground">Critical Path</span>
        </div>
      </div>

      {/* Right: Filters + Export */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuCheckboxItem
              checked={filters.hideCompleted}
              onCheckedChange={(v) => onFiltersChange({ ...filters, hideCompleted: v })}
            >
              Hide completed items
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filters.showOnlyCritical}
              onCheckedChange={(v) => onFiltersChange({ ...filters, showOnlyCritical: v })}
            >
              Show only critical path
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filters.hideTasks}
              onCheckedChange={(v) => onFiltersChange({ ...filters, hideTasks: v })}
            >
              Hide tasks (milestones only)
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={onExport}
          disabled={isExporting}
        >
          <Download className="h-3.5 w-3.5" />
          {isExporting ? "Exporting…" : "Export PNG"}
        </Button>
      </div>
    </div>
  );
}
