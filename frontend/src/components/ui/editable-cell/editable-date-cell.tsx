"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CellError } from "./cell-error";
import type { DateEditableCellProps } from "./types";
import { useCellSave } from "./use-cell-save";

/**
 * Date Editable Cell
 */
export function EditableDateCell({
  value,
  rowId,
  columnId,
  isEditing,
  editable = true,
  isSaving,
  error,
  onStartEdit,
  onCancelEdit,
  onSave,
  validate,
  validationRules,
  placeholder = "Select date",
  className,
  formatDisplay,
  dateFormat = "PPP",
}: DateEditableCellProps) {
  const [editValue, setEditValue] = useState<Date | undefined>(
    value instanceof Date ? value : undefined,
  );
  const [open, setOpen] = useState(false);
  const { localError, saveValue } = useCellSave({
    rowId,
    columnId,
    validationRules,
    validate,
    onSave,
  });

  // Sync edit value when value prop changes
  useEffect(() => {
    setEditValue(value instanceof Date ? value : undefined);
  }, [value]);

  // Open popover when editing starts
  useEffect(() => {
    if (isEditing) {
      setOpen(true);
    }
  }, [isEditing]);

  const handleSelect = async (date: Date | undefined) => {
    if (!date) return;

    setEditValue(date);
    const ok = await saveValue(date);
    if (ok) {
      setOpen(false);
      onCancelEdit?.();
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen && isEditing) {
      onCancelEdit?.();
    }
  };

  const displayValue =
    formatDisplay?.(value) ?? (value instanceof Date ? format(value, dateFormat) : "");
  const displayError = error ?? localError;

  if (!editable) {
    return (
      <span className={cn("block truncate", className)}>
        {displayValue || <span className="text-muted-foreground italic">{placeholder}</span>}
      </span>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <Popover open={open && isEditing} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-8 w-full justify-start text-left font-normal",
              !value && "text-muted-foreground",
              displayError && "border-destructive",
            )}
            onClick={() => {
              if (!isEditing && !isSaving) {
                onStartEdit?.(rowId, columnId);
              }
            }}
          >
            {displayValue || placeholder}
            {isSaving && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={editValue} onSelect={handleSelect} initialFocus />
        </PopoverContent>
      </Popover>
      {displayError && <CellError message={displayError} />}
    </div>
  );
}
