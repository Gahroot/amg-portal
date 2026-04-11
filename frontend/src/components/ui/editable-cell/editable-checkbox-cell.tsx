"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { CellError } from "./cell-error";
import type { CheckboxEditableCellProps } from "./types";
import { useCellSave } from "./use-cell-save";

/**
 * Checkbox Editable Cell
 */
export function EditableCheckboxCell({
  value,
  rowId,
  columnId,
  editable = true,
  isSaving,
  error,
  onSave,
  validate,
  validationRules,
  className,
  checkboxLabel = "Checkbox",
}: CheckboxEditableCellProps) {
  const { localError, setLocalError, saveValue } = useCellSave({
    rowId,
    columnId,
    validationRules,
    validate,
    onSave,
  });
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boolValue = Boolean(value);

  useEffect(() => {
    if (localError) {
      errorTimerRef.current = setTimeout(() => setLocalError(null), 3000);
      return () => {
        if (errorTimerRef.current) {
          clearTimeout(errorTimerRef.current);
        }
      };
    }
    return undefined;
  }, [localError, setLocalError]);

  const handleCheck = async (checked: boolean | "indeterminate") => {
    if (!editable || isSaving) return;
    await saveValue(checked === true);
  };

  const displayError = error ?? localError;

  return (
    <div className={cn("relative flex items-center gap-2", className)}>
      <Checkbox
        checked={boolValue}
        onCheckedChange={handleCheck}
        disabled={!editable || isSaving}
        aria-label={checkboxLabel}
      />
      {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {displayError && <CellError message={displayError} />}
    </div>
  );
}
