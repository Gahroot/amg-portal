"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ReportType =
  | "portfolio"
  | "program_status"
  | "completion"
  | "annual_review";

export interface ReportFilters {
  reportType: ReportType;
  startDate: Date | undefined;
  endDate: Date | undefined;
  year: number;
}

interface ReportFiltersProps {
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
  onGenerate: () => void;
  isGenerating?: boolean;
}

const REPORT_TYPES: { value: ReportType; label: string; description: string }[] = [
  {
    value: "portfolio",
    label: "Portfolio Overview",
    description: "Complete client portfolio summary with program metrics",
  },
  {
    value: "program_status",
    label: "Program Status",
    description: "Current status of all active programs and milestones",
  },
  {
    value: "completion",
    label: "Completion Report",
    description: "Post-completion analysis with timeline and budget adherence",
  },
  {
    value: "annual_review",
    label: "Annual Review",
    description: "Year-end summary of programs, partners, and performance",
  },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

export function ReportFiltersPanel({
  filters,
  onFiltersChange,
  onGenerate,
  isGenerating = false,
}: ReportFiltersProps) {
  const showYearSelector = filters.reportType === "annual_review";
  const showDateRange =
    filters.reportType === "portfolio" || filters.reportType === "program_status";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Generate Report</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Report Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Report Type</label>
          <Select
            value={filters.reportType}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, reportType: value as ReportType })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select report type" />
            </SelectTrigger>
            <SelectContent>
              {REPORT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  <div className="flex flex-col">
                    <span>{type.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {type.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range */}
        {showDateRange && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.startDate
                      ? format(filters.startDate, "PPP")
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.startDate}
                    onSelect={(date) =>
                      onFiltersChange({ ...filters, startDate: date ?? undefined })
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.endDate
                      ? format(filters.endDate, "PPP")
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.endDate}
                    onSelect={(date) =>
                      onFiltersChange({ ...filters, endDate: date ?? undefined })
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {/* Year Selector */}
        {showYearSelector && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Year</label>
            <Select
              value={String(filters.year)}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, year: Number(value) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Generate Button */}
        <Button
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? "Generating..." : "Generate Report"}
        </Button>
      </CardContent>
    </Card>
  );
}
