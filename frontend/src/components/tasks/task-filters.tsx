"use client";

import { Filter, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AssigneeInfo, ProgramInfo } from "@/types/task";

interface TaskFiltersProps {
  programs: ProgramInfo[];
  assignees: AssigneeInfo[];
  selectedProgram: string | undefined;
  selectedAssignee: string | undefined;
  selectedStatus: string | undefined;
  overdueOnly: boolean;
  onProgramChange: (value: string | undefined) => void;
  onAssigneeChange: (value: string | undefined) => void;
  onStatusChange: (value: string | undefined) => void;
  onOverdueChange: (value: boolean) => void;
  onClearFilters: () => void;
}

export function TaskFilters({
  programs,
  assignees,
  selectedProgram,
  selectedAssignee,
  selectedStatus,
  overdueOnly,
  onProgramChange,
  onAssigneeChange,
  onStatusChange,
  onOverdueChange,
  onClearFilters,
}: TaskFiltersProps) {
  const hasFilters = selectedProgram || selectedAssignee || selectedStatus || overdueOnly;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={selectedProgram || "all"}
        onValueChange={(value) => onProgramChange(value === "all" ? undefined : value)}
      >
        <SelectTrigger size="sm" className="w-[180px]">
          <SelectValue placeholder="All Programs" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Programs</SelectItem>
          {programs.map((program) => (
            <SelectItem key={program.id} value={program.id}>
              {program.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedAssignee || "all"}
        onValueChange={(value) => onAssigneeChange(value === "all" ? undefined : value)}
      >
        <SelectTrigger size="sm" className="w-[180px]">
          <SelectValue placeholder="All Assignees" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Assignees</SelectItem>
          {assignees.map((assignee) => (
            <SelectItem key={assignee.id} value={assignee.id}>
              {assignee.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedStatus || "all"}
        onValueChange={(value) => onStatusChange(value === "all" ? undefined : value)}
      >
        <SelectTrigger size="sm" className="w-[140px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="todo">To Do</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="blocked">Blocked</SelectItem>
          <SelectItem value="done">Done</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant={overdueOnly ? "default" : "outline"}
        size="sm"
        onClick={() => onOverdueChange(!overdueOnly)}
        className="gap-1.5"
      >
        <Filter className="size-4" />
        Overdue Only
      </Button>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters} className="gap-1.5">
          <X className="size-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
