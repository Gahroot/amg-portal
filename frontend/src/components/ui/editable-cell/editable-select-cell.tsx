"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CellError } from "./cell-error";
import type { SelectEditableCellProps } from "./types";
import { useCellSave } from "./use-cell-save";

/**
 * Select Editable Cell
 */
export function EditableSelectCell({
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
  placeholder = "Select...",
  className,
  formatDisplay,
  options,
  selectPlaceholder = "Select an option",
}: SelectEditableCellProps) {
  const [open, setOpen] = useState(false);
  const { localError, saveValue } = useCellSave({
    rowId,
    columnId,
    validationRules,
    validate,
    onSave,
  });

  // Open select when editing starts
  useEffect(() => {
    if (isEditing) {
      setOpen(true);
    }
  }, [isEditing]);

  const handleValueChange = async (newValue: string) => {
    const ok = await saveValue(newValue);
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

  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = formatDisplay?.(value) ?? selectedOption?.label ?? "";
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
      <Select
        open={open && isEditing}
        onOpenChange={handleOpenChange}
        value={String(value ?? "")}
        onValueChange={handleValueChange}
      >
        <SelectTrigger
          className={cn("h-8 w-full cursor-pointer", displayError && "border-destructive")}
          onClick={() => {
            if (!isEditing && !isSaving) {
              onStartEdit?.(rowId, columnId);
            }
          }}
        >
          <SelectValue placeholder={selectPlaceholder}>
            {displayValue || (
              <span className="text-muted-foreground">{selectPlaceholder}</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isSaving && (
        <div className="absolute right-8 top-1/2 -translate-y-1/2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {displayError && <CellError message={displayError} />}
    </div>
  );
}
