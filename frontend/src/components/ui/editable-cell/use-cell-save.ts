"use client";

import { useCallback, useState } from "react";
import type { ValidationRule } from "@/hooks/use-field-validation";
import type { ValidationResult } from "./types";
import { validateValue } from "./validate-value";

interface UseCellSaveOptions {
  rowId: string;
  columnId: string;
  validationRules?: ValidationRule;
  validate?: (value: unknown) => ValidationResult | Promise<ValidationResult>;
  onSave?: (
    rowId: string,
    columnId: string,
    value: unknown,
  ) => Promise<ValidationResult | void> | ValidationResult | void;
}

interface UseCellSaveResult {
  localError: string | null;
  setLocalError: (error: string | null) => void;
  saveValue: (value: unknown) => Promise<boolean>;
}

/**
 * Shared hook for validating + persisting a cell value.
 * Returns true if save succeeded, false otherwise.
 */
export function useCellSave({
  rowId,
  columnId,
  validationRules,
  validate,
  onSave,
}: UseCellSaveOptions): UseCellSaveResult {
  const [localError, setLocalError] = useState<string | null>(null);

  const saveValue = useCallback(
    async (value: unknown): Promise<boolean> => {
      const validation = await validateValue(value, validationRules, validate);
      if (!validation.isValid) {
        setLocalError(validation.error ?? "Invalid value");
        return false;
      }

      setLocalError(null);
      const result = await onSave?.(rowId, columnId, value);
      if (result && !result.isValid) {
        setLocalError(result.error ?? "Save failed");
        return false;
      }
      return true;
    },
    [rowId, columnId, validationRules, validate, onSave],
  );

  return { localError, setLocalError, saveValue };
}
