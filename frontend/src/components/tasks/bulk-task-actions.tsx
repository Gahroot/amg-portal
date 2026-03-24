"use client";

/**
 * BulkTaskActions — modal dialogs for reassign, status, due-date, and delete.
 * Each dialog is opened by the parent (TaskBoard) passing `activeAction`.
 */

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

import type { AssigneeInfo, TaskStatus, TaskPriority } from "@/types/task";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/types/task";

export type BulkActionType = "reassign" | "status" | "due-date" | "delete" | null;

// ─── Reassign Dialog ─────────────────────────────────────────────────────────

interface ReassignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignees: AssigneeInfo[];
  selectedCount: number;
  onConfirm: (assigneeId: string | null) => void;
  isLoading?: boolean;
}

export function ReassignDialog({
  open,
  onOpenChange,
  assignees,
  selectedCount,
  onConfirm,
  isLoading,
}: ReassignDialogProps) {
  const [value, setValue] = useState<string>("");

  const handleConfirm = () => {
    onConfirm(value === "__clear__" ? null : value || null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reassign {selectedCount} task{selectedCount !== 1 ? "s" : ""}</DialogTitle>
          <DialogDescription>
            Choose a team member to assign all selected tasks to.
          </DialogDescription>
        </DialogHeader>

        <Select value={value} onValueChange={setValue}>
          <SelectTrigger>
            <SelectValue placeholder="Select assignee…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__clear__">
              <span className="text-muted-foreground">— Unassign —</span>
            </SelectItem>
            {assignees.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!value || isLoading}>
            {isLoading ? "Applying…" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Status Dialog ────────────────────────────────────────────────────────────

interface StatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (status: TaskStatus) => void;
  isLoading?: boolean;
}

export function StatusDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
  isLoading,
}: StatusDialogProps) {
  const [value, setValue] = useState<string>("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Change status for {selectedCount} task{selectedCount !== 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>All selected tasks will be moved to this status.</DialogDescription>
        </DialogHeader>

        <Select value={value} onValueChange={setValue}>
          <SelectTrigger>
            <SelectValue placeholder="Select status…" />
          </SelectTrigger>
          <SelectContent>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(value as TaskStatus)} disabled={!value || isLoading}>
            {isLoading ? "Applying…" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Priority Dialog ──────────────────────────────────────────────────────────

interface PriorityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (priority: TaskPriority) => void;
  isLoading?: boolean;
}

export function PriorityDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
  isLoading,
}: PriorityDialogProps) {
  const [value, setValue] = useState<string>("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Set priority for {selectedCount} task{selectedCount !== 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>All selected tasks will receive this priority level.</DialogDescription>
        </DialogHeader>

        <Select value={value} onValueChange={setValue}>
          <SelectTrigger>
            <SelectValue placeholder="Select priority…" />
          </SelectTrigger>
          <SelectContent>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                <span className={p.color}>{p.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(value as TaskPriority)}
            disabled={!value || isLoading}
          >
            {isLoading ? "Applying…" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Due Date Dialog ──────────────────────────────────────────────────────────

interface DueDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (date: Date | null) => void;
  isLoading?: boolean;
}

export function DueDateDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
  isLoading,
}: DueDateDialogProps) {
  const [date, setDate] = useState<Date | undefined>();
  const [calOpen, setCalOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Set due date for {selectedCount} task{selectedCount !== 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            Choose a date to apply to all selected tasks, or clear the existing due dates.
          </DialogDescription>
        </DialogHeader>

        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !date && "text-muted-foreground",
              )}
            >
              <CalendarDays className="mr-2 size-4" />
              {date ? format(date, "PPP") : "Pick a date…"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => {
                setDate(d);
                setCalOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onConfirm(null)}
            disabled={isLoading}
            className="text-destructive hover:text-destructive"
          >
            Clear due dates
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={() => date && onConfirm(date)} disabled={!date || isLoading}>
              {isLoading ? "Applying…" : "Apply"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirmation Dialog ───────────────────────────────────────────────

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function DeleteDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
  isLoading,
}: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            Delete {selectedCount} task{selectedCount !== 1 ? "s" : ""}?
          </DialogTitle>
          <DialogDescription>
            This will permanently delete the selected task
            {selectedCount !== 1 ? "s" : ""}. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "Deleting…" : `Delete ${selectedCount} task${selectedCount !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
