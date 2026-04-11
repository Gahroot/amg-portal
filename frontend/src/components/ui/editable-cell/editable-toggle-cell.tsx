"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { CellError } from "./cell-error";
import type { ToggleEditableCellProps } from "./types";
import { useCellSave } from "./use-cell-save";

/**
 * Toggle Editable Cell
 */
export function EditableToggleCell({
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
  toggleLabel = "Toggle",
}: ToggleEditableCellProps) {
  const { localError, setLocalError, saveValue } = useCellSave({
    rowId,
    columnId,
    validationRules,
    validate,
    onSave,
  });
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boolValue = Boolean(value);

  // Auto-clear inline errors after 3s, mirroring original behaviour.
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

  const handleToggle = async () => {
    if (!editable || isSaving) return;
    await saveValue(!boolValue);
  };

  const displayError = error ?? localError;

  return (
    <div className={cn("relative flex items-center gap-2", className)}>
      <Switch
        checked={boolValue}
        onCheckedChange={handleToggle}
        disabled={!editable || isSaving}
        aria-label={toggleLabel}
        className="data-[state=checked]:bg-primary"
      />
      {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {displayError && <CellError message={displayError} />}
    </div>
  );
}
