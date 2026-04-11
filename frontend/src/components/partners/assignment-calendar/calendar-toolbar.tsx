"use client";

import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  LayoutGrid,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { CalendarProgram } from "./use-calendar-events";
import type { ViewMode } from "./types";

export interface CalendarToolbarProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  navigateBack: () => void;
  navigateForward: () => void;
  goToToday: () => void;
  onExport: () => void;
  exportDisabled: boolean;
  selectedProgramId: string;
  setSelectedProgramId: (id: string) => void;
  showCompleted: boolean;
  setShowCompleted: (show: boolean) => void;
  programs: CalendarProgram[];
  programColorMap: Map<string, string>;
}

export function CalendarToolbar({
  viewMode,
  setViewMode,
  navigateBack,
  navigateForward,
  goToToday,
  onExport,
  exportDisabled,
  selectedProgramId,
  setSelectedProgramId,
  showCompleted,
  setShowCompleted,
  programs,
  programColorMap,
}: CalendarToolbarProps) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border">
          <Button
            variant={viewMode === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("month")}
            className="rounded-r-none gap-1.5"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Month
          </Button>
          <Button
            variant={viewMode === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("week")}
            className="rounded-none gap-1.5"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            Week
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="rounded-l-none gap-1.5"
          >
            <List className="h-3.5 w-3.5" />
            List
          </Button>
        </div>

        {viewMode !== "list" && (
          <>
            <Button variant="outline" size="icon" onClick={navigateBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={navigateForward}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={onExport}
          disabled={exportDisabled}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
          <SelectTrigger className="h-8 w-48 text-sm">
            <SelectValue placeholder="All programs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All programs</SelectItem>
            {programs.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${programColorMap.get(p.id) ?? "bg-muted-foreground"}`}
                  />
                  {p.title}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch
            id="show-completed"
            checked={showCompleted}
            onCheckedChange={setShowCompleted}
          />
          <Label htmlFor="show-completed" className="cursor-pointer text-sm">
            Show completed
          </Label>
        </div>

        {selectedProgramId === "all" && programs.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {programs.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center gap-1.5">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${programColorMap.get(p.id) ?? "bg-muted-foreground"}`}
                />
                <span className="max-w-[120px] truncate text-xs text-muted-foreground">
                  {p.title}
                </span>
              </div>
            ))}
            {programs.length > 5 && (
              <span className="text-xs text-muted-foreground">
                +{programs.length - 5} more
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 pt-1">
        <div className="flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Assignment deadline
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Deliverable deadline
          </span>
        </div>
      </div>
    </>
  );
}
