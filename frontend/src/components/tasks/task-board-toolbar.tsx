"use client";

import { CheckSquare, GitBranch, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTableExport } from "@/components/ui/data-table-export";
import { TaskFilters } from "./task-filters";
import type { ExportColumn } from "@/lib/export-utils";
import { API_BASE_URL } from "@/lib/constants";
import type { TaskBoard, AssigneeInfo, ProgramInfo } from "@/types/task";

const TASK_EXPORT_COLUMNS: ExportColumn<TaskBoard>[] = [
  { header: "Title", accessor: "title" },
  { header: "Status", accessor: "status" },
  { header: "Priority", accessor: "priority" },
  { header: "Due Date", accessor: (r) => r.due_date ?? "" },
  { header: "Assigned To", accessor: (r) => r.assignee?.name ?? "" },
  { header: "Program", accessor: (r) => r.program?.title ?? "" },
  { header: "Milestone", accessor: (r) => r.milestone?.title ?? "" },
  { header: "Description", accessor: (r) => r.description ?? "" },
  { header: "Created", accessor: (r) => new Date(r.created_at).toLocaleDateString() },
];

interface TaskBoardToolbarProps {
  // Filter props
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
  // Export props
  tasks: TaskBoard[];
  // View toggles
  graphView: boolean;
  onToggleGraphView: () => void;
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
  // Actions
  onAddTask: () => void;
}

export function TaskBoardToolbar({
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
  tasks,
  graphView,
  onToggleGraphView,
  selectionMode,
  onToggleSelectionMode,
  onAddTask,
}: TaskBoardToolbarProps) {
  const exportParams = new URLSearchParams();
  if (selectedProgram) exportParams.set("program_id", selectedProgram);
  if (selectedAssignee) exportParams.set("assignee_id", selectedAssignee);
  if (selectedStatus) exportParams.set("status", selectedStatus);
  const exportQs = exportParams.toString();
  const exportAllUrl = `${API_BASE_URL}/api/v1/export/tasks${exportQs ? `?${exportQs}` : ""}`;

  return (
    <div className="flex items-center justify-between">
      <TaskFilters
        programs={programs}
        assignees={assignees}
        selectedProgram={selectedProgram}
        selectedAssignee={selectedAssignee}
        selectedStatus={selectedStatus}
        overdueOnly={overdueOnly}
        onProgramChange={onProgramChange}
        onAssigneeChange={onAssigneeChange}
        onStatusChange={onStatusChange}
        onOverdueChange={onOverdueChange}
        onClearFilters={onClearFilters}
      />
      <div className="flex items-center gap-2">
        <DataTableExport
          visibleRows={tasks}
          columns={TASK_EXPORT_COLUMNS}
          fileName="tasks"
          exportAllUrl={exportAllUrl}
        />
        <Button
          variant={graphView ? "secondary" : "outline"}
          size="sm"
          onClick={onToggleGraphView}
          className="gap-1.5"
        >
          <GitBranch className="size-4" />
          {graphView ? "Board view" : "Dependency graph"}
        </Button>
        <Button
          variant={selectionMode ? "secondary" : "outline"}
          size="sm"
          onClick={onToggleSelectionMode}
          className="gap-1.5"
        >
          <CheckSquare className="size-4" />
          {selectionMode ? "Cancel selection" : "Select"}
        </Button>
        <Button onClick={onAddTask} className="gap-1.5">
          <Plus className="size-4" />
          Add Task
        </Button>
      </div>
    </div>
  );
}
