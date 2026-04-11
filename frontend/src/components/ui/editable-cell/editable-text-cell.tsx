"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { CellError } from "./cell-error";
import { defaultFormatters, type TextEditableCellProps } from "./types";
import { useCellSave } from "./use-cell-save";

/**
 * Text/Number/Email/Tel/URL Editable Cell
 */
export function EditableTextCell({
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
  placeholder = "Click to edit",
  className,
  showEditIcon = true,
  formatDisplay,
  type,
  maxLength,
  min,
  max,
}: TextEditableCellProps) {
  const [editValue, setEditValue] = useState(String(value ?? ""));
  const inputRef = useRef<HTMLInputElement>(null);
  const { localError, setLocalError, saveValue } = useCellSave({
    rowId,
    columnId,
    validationRules,
    validate,
    onSave,
  });

  // Sync edit value when value prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(String(value ?? ""));
    }
  }, [value, isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (editable && !isSaving) {
      setEditValue(String(value ?? ""));
      setLocalError(null);
      onStartEdit?.(rowId, columnId);
    }
  };

  const handleSave = async () => {
    await saveValue(type === "number" ? Number(editValue) : editValue);
  };

  const handleCancel = () => {
    setEditValue(String(value ?? ""));
    setLocalError(null);
    onCancelEdit?.();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleBlur = () => {
    // Small delay to allow click events to fire first
    setTimeout(() => {
      if (isEditing && !isSaving) {
        handleSave();
      }
    }, 100);
  };

  const displayValue =
    formatDisplay?.(value) ?? defaultFormatters[type]?.(value) ?? String(value ?? "");
  const displayError = error ?? localError;

  if (!editable) {
    return (
      <span className={cn("block truncate", className)}>
        {displayValue || <span className="text-muted-foreground italic">{placeholder}</span>}
      </span>
    );
  }

  if (isEditing) {
    return (
      <div className="relative">
        <Input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          maxLength={maxLength}
          min={min}
          max={max}
          className={cn(
            "h-8 w-full px-2 py-1 text-sm",
            displayError && "border-destructive focus-visible:ring-destructive/50",
          )}
          disabled={isSaving}
        />
        {isSaving && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {displayError && !isSaving && <CellError message={displayError} />}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleStartEdit}
      onKeyDown={(e) => e.key === "Enter" && handleStartEdit()}
      className={cn(
        "group flex min-h-[2rem] w-full cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        displayError && "bg-destructive/10 text-destructive",
        className,
      )}
    >
      <span className="truncate">
        {displayValue || <span className="text-muted-foreground italic">{placeholder}</span>}
      </span>
      {showEditIcon && !isSaving && (
        <Pencil className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
      )}
      {isSaving && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />}
    </div>
  );
}
