"use client";

import * as React from "react";
import { Loader2, Check, X, Pencil, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import type { ValidationRule } from "@/hooks/use-field-validation";

/**
 * Cell edit state
 */
export interface CellEditState {
  /** Row ID being edited */
  rowId: string;
  /** Column ID being edited */
  columnId: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether the value is valid */
  isValid: boolean;
  /** Error message if invalid */
  error?: string;
}

/**
 * Base props for editable cell
 */
export interface EditableCellBaseProps {
  /** Current cell value */
  value: unknown;
  /** Row ID */
  rowId: string;
  /** Column ID */
  columnId: string;
  /** Whether the cell is currently being edited */
  isEditing: boolean;
  /** Whether the cell is editable */
  editable?: boolean;
  /** Whether a save is in progress */
  isSaving?: boolean;
  /** Validation error message */
  error?: string | null;
  /** Callback when cell is clicked to start editing */
  onStartEdit?: (rowId: string, columnId: string) => void;
  /** Callback when edit is cancelled */
  onCancelEdit?: () => void;
  /** Callback when value is saved */
  onSave?: (rowId: string, columnId: string, value: unknown) => Promise<ValidationResult | void> | ValidationResult | void;
  /** Custom validation function */
  validate?: (value: unknown) => ValidationResult | Promise<ValidationResult>;
  /** Validation rules (reused from use-field-validation) */
  validationRules?: ValidationRule;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Additional class names */
  className?: string;
  /** Whether to show edit icon on hover */
  showEditIcon?: boolean;
  /** Custom display formatter */
  formatDisplay?: (value: unknown) => string;
}

/**
 * Props for text editable cell
 */
export interface TextEditableCellProps extends EditableCellBaseProps {
  type: "text" | "number" | "email" | "tel" | "url";
  /** Max length for text input */
  maxLength?: number;
  /** Min value for number input */
  min?: number;
  /** Max value for number input */
  max?: number;
}

/**
 * Props for select editable cell
 */
export interface SelectEditableCellProps extends EditableCellBaseProps {
  type: "select";
  /** Select options */
  options: Array<{ value: string; label: string }>;
  /** Placeholder for select */
  selectPlaceholder?: string;
}

/**
 * Props for date editable cell
 */
export interface DateEditableCellProps extends EditableCellBaseProps {
  type: "date";
  /** Date format for display */
  dateFormat?: string;
}

/**
 * Props for toggle editable cell
 */
export interface ToggleEditableCellProps extends EditableCellBaseProps {
  type: "toggle";
  /** Label for the toggle (screen reader) */
  toggleLabel?: string;
}

/**
 * Props for checkbox editable cell
 */
export interface CheckboxEditableCellProps extends EditableCellBaseProps {
  type: "checkbox";
  /** Label for the checkbox (screen reader) */
  checkboxLabel?: string;
}

/**
 * Union type for all editable cell props
 */
export type EditableCellProps =
  | TextEditableCellProps
  | SelectEditableCellProps
  | DateEditableCellProps
  | ToggleEditableCellProps
  | CheckboxEditableCellProps;

/**
 * Default display formatters
 */
const defaultFormatters: Record<string, (value: unknown) => string> = {
  text: (v) => (v == null ? "" : String(v)),
  number: (v) => (v == null ? "" : String(v)),
  email: (v) => (v == null ? "" : String(v)),
  tel: (v) => (v == null ? "" : String(v)),
  url: (v) => (v == null ? "" : String(v)),
  select: (v) => (v == null ? "" : String(v)),
  date: (v) => (v instanceof Date ? format(v, "PPP") : v == null ? "" : String(v)),
  toggle: (v) => (v ? "Yes" : "No"),
  checkbox: (v) => (v ? "Yes" : "No"),
};

/**
 * Validate value using validation rules
 */
async function validateValue(
  value: unknown,
  rules?: ValidationRule,
  customValidate?: (value: unknown) => ValidationResult | Promise<ValidationResult>
): Promise<ValidationResult> {
  // Custom validation takes precedence
  if (customValidate) {
    const result = await customValidate(value);
    if (!result.isValid) {
      return result;
    }
  }

  // Required validation
  if (rules?.required) {
    const isEmpty = value == null || value === "";
    if (isEmpty) {
      return {
        isValid: false,
        error: typeof rules.required === "string" ? rules.required : "This field is required",
      };
    }
  }

  // Email validation
  if (rules?.email && value) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(String(value))) {
      return {
        isValid: false,
        error: typeof rules.email === "string" ? rules.email : "Please enter a valid email",
      };
    }
  }

  // URL validation
  if (rules?.url && value) {
    try {
      new URL(String(value));
    } catch {
      return {
        isValid: false,
        error: typeof rules.url === "string" ? rules.url : "Please enter a valid URL",
      };
    }
  }

  // Min length
  if (rules?.minLength !== undefined && value) {
    const minLen = typeof rules.minLength === "object" ? rules.minLength.value : rules.minLength;
    if (String(value).length < minLen) {
      return {
        isValid: false,
        error:
          typeof rules.minLength === "object"
            ? rules.minLength.message
            : `Minimum ${minLen} characters required`,
      };
    }
  }

  // Max length
  if (rules?.maxLength !== undefined && value) {
    const maxLen = typeof rules.maxLength === "object" ? rules.maxLength.value : rules.maxLength;
    if (String(value).length > maxLen) {
      return {
        isValid: false,
        error:
          typeof rules.maxLength === "object"
            ? rules.maxLength.message
            : `Maximum ${maxLen} characters allowed`,
      };
    }
  }

  // Min value (for numbers)
  if (rules?.min !== undefined && value !== "" && value !== null) {
    const minVal = typeof rules.min === "object" ? rules.min.value : rules.min;
    if (Number(value) < minVal) {
      return {
        isValid: false,
        error:
          typeof rules.min === "object" ? rules.min.message : `Minimum value is ${minVal}`,
      };
    }
  }

  // Max value (for numbers)
  if (rules?.max !== undefined && value !== "" && value !== null) {
    const maxVal = typeof rules.max === "object" ? rules.max.value : rules.max;
    if (Number(value) > maxVal) {
      return {
        isValid: false,
        error:
          typeof rules.max === "object" ? rules.max.message : `Maximum value is ${maxVal}`,
      };
    }
  }

  // Pattern validation
  if (rules?.pattern && value) {
    const patternObj = rules.pattern;
    const pattern = "value" in patternObj ? patternObj.value : patternObj;
    if (!pattern.test(String(value))) {
      return {
        isValid: false,
        error: "value" in patternObj && "message" in patternObj ? patternObj.message : "Invalid format",
      };
    }
  }

  // Custom validation function from rules
  if (rules?.validate) {
    const result = await rules.validate(value);
    if (result === false) {
      return { isValid: false, error: "Invalid value" };
    }
    if (typeof result === "string") {
      return { isValid: false, error: result };
    }
  }

  return { isValid: true };
}

/**
 * Text/Number/Email/Tel/URL Editable Cell
 */
function TextEditableCell({
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
  const [editValue, setEditValue] = React.useState(String(value ?? ""));
  const [localError, setLocalError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Sync edit value when value prop changes
  React.useEffect(() => {
    if (!isEditing) {
      setEditValue(String(value ?? ""));
    }
  }, [value, isEditing]);

  // Focus input when editing starts
  React.useEffect(() => {
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
    // Validate first
    const validation = await validateValue(editValue, validationRules, validate);
    if (!validation.isValid) {
      setLocalError(validation.error ?? "Invalid value");
      return;
    }

    setLocalError(null);
    const result = await onSave?.(rowId, columnId, type === "number" ? Number(editValue) : editValue);
    if (result && !result.isValid) {
      setLocalError(result.error ?? "Save failed");
    }
  };

  const handleCancel = () => {
    setEditValue(String(value ?? ""));
    setLocalError(null);
    onCancelEdit?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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

  const displayValue = formatDisplay?.(value) ?? defaultFormatters[type]?.(value) ?? String(value ?? "");
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
            displayError && "border-destructive focus-visible:ring-destructive/50"
          )}
          disabled={isSaving}
        />
        {isSaving && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {displayError && !isSaving && (
          <div className="absolute -bottom-6 left-0 z-10 flex items-center gap-1 rounded bg-destructive px-2 py-1 text-xs text-destructive-foreground shadow-sm">
            <AlertCircle className="h-3 w-3" />
            {displayError}
          </div>
        )}
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
        className
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

/**
 * Select Editable Cell
 */
function SelectEditableCell({
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
  showEditIcon = true,
  formatDisplay,
  type,
  options,
  selectPlaceholder = "Select an option",
}: SelectEditableCellProps) {
  const [editValue, setEditValue] = React.useState(String(value ?? ""));
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  // Sync edit value when value prop changes
  React.useEffect(() => {
    setEditValue(String(value ?? ""));
  }, [value]);

  // Open select when editing starts
  React.useEffect(() => {
    if (isEditing) {
      setOpen(true);
    }
  }, [isEditing]);

  const handleValueChange = async (newValue: string) => {
    setEditValue(newValue);
    
    // Validate
    const validation = await validateValue(newValue, validationRules, validate);
    if (!validation.isValid) {
      setLocalError(validation.error ?? "Invalid value");
      return;
    }

    setLocalError(null);
    const result = await onSave?.(rowId, columnId, newValue);
    if (result && !result.isValid) {
      setLocalError(result.error ?? "Save failed");
    } else {
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
      <Select open={open && isEditing} onOpenChange={handleOpenChange} value={String(value ?? "")} onValueChange={handleValueChange}>
        <SelectTrigger
          className={cn(
            "h-8 w-full cursor-pointer",
            displayError && "border-destructive"
          )}
          onClick={() => {
            if (!isEditing && !isSaving) {
              onStartEdit?.(rowId, columnId);
            }
          }}
        >
          <SelectValue placeholder={selectPlaceholder}>
            {displayValue || <span className="text-muted-foreground">{selectPlaceholder}</span>}
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
      {displayError && (
        <div className="absolute -bottom-6 left-0 z-10 flex items-center gap-1 rounded bg-destructive px-2 py-1 text-xs text-destructive-foreground shadow-sm">
          <AlertCircle className="h-3 w-3" />
          {displayError}
        </div>
      )}
    </div>
  );
}

/**
 * Date Editable Cell
 */
function DateEditableCell({
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
  showEditIcon = true,
  formatDisplay,
  type,
  dateFormat = "PPP",
}: DateEditableCellProps) {
  const [editValue, setEditValue] = React.useState<Date | undefined>(
    value instanceof Date ? value : undefined
  );
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  // Sync edit value when value prop changes
  React.useEffect(() => {
    setEditValue(value instanceof Date ? value : undefined);
  }, [value]);

  // Open popover when editing starts
  React.useEffect(() => {
    if (isEditing) {
      setOpen(true);
    }
  }, [isEditing]);

  const handleSelect = async (date: Date | undefined) => {
    if (!date) return;
    
    setEditValue(date);

    // Validate
    const validation = await validateValue(date, validationRules, validate);
    if (!validation.isValid) {
      setLocalError(validation.error ?? "Invalid date");
      return;
    }

    setLocalError(null);
    const result = await onSave?.(rowId, columnId, date);
    if (result && !result.isValid) {
      setLocalError(result.error ?? "Save failed");
    } else {
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
    formatDisplay?.(value) ??
    (value instanceof Date ? format(value, dateFormat) : "");
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
              displayError && "border-destructive"
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
          <Calendar
            mode="single"
            selected={editValue}
            onSelect={handleSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {displayError && (
        <div className="absolute -bottom-6 left-0 z-10 flex items-center gap-1 rounded bg-destructive px-2 py-1 text-xs text-destructive-foreground shadow-sm">
          <AlertCircle className="h-3 w-3" />
          {displayError}
        </div>
      )}
    </div>
  );
}

/**
 * Toggle Editable Cell
 */
function ToggleEditableCell({
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
  const [localError, setLocalError] = React.useState<string | null>(null);
  const boolValue = Boolean(value);

  const handleToggle = async () => {
    if (!editable || isSaving) return;

    const newValue = !boolValue;

    // Validate
    const validation = await validateValue(newValue, validationRules, validate);
    if (!validation.isValid) {
      setLocalError(validation.error ?? "Invalid value");
      setTimeout(() => setLocalError(null), 3000);
      return;
    }

    setLocalError(null);
    const result = await onSave?.(rowId, columnId, newValue);
    if (result && !result.isValid) {
      setLocalError(result.error ?? "Save failed");
      setTimeout(() => setLocalError(null), 3000);
    }
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
      {displayError && (
        <div className="absolute -bottom-6 left-0 z-10 flex items-center gap-1 rounded bg-destructive px-2 py-1 text-xs text-destructive-foreground shadow-sm">
          <AlertCircle className="h-3 w-3" />
          {displayError}
        </div>
      )}
    </div>
  );
}

/**
 * Checkbox Editable Cell
 */
function CheckboxEditableCell({
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
  const [localError, setLocalError] = React.useState<string | null>(null);
  const boolValue = Boolean(value);

  const handleCheck = async (checked: boolean | "indeterminate") => {
    if (!editable || isSaving) return;

    const newValue = checked === true;

    // Validate
    const validation = await validateValue(newValue, validationRules, validate);
    if (!validation.isValid) {
      setLocalError(validation.error ?? "Invalid value");
      setTimeout(() => setLocalError(null), 3000);
      return;
    }

    setLocalError(null);
    const result = await onSave?.(rowId, columnId, newValue);
    if (result && !result.isValid) {
      setLocalError(result.error ?? "Save failed");
      setTimeout(() => setLocalError(null), 3000);
    }
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
      {displayError && (
        <div className="absolute -bottom-6 left-0 z-10 flex items-center gap-1 rounded bg-destructive px-2 py-1 text-xs text-destructive-foreground shadow-sm">
          <AlertCircle className="h-3 w-3" />
          {displayError}
        </div>
      )}
    </div>
  );
}

/**
 * Main EditableCell component that renders the appropriate cell type
 */
export function EditableCell(props: EditableCellProps) {
  switch (props.type) {
    case "text":
    case "number":
    case "email":
    case "tel":
    case "url":
      return <TextEditableCell {...props} />;
    case "select":
      return <SelectEditableCell {...props} />;
    case "date":
      return <DateEditableCell {...props} />;
    case "toggle":
      return <ToggleEditableCell {...props} />;
    case "checkbox":
      return <CheckboxEditableCell {...props} />;
    default:
      return null;
  }
}

/**
 * Higher-order component to create an editable cell column definition
 */
export function createEditableColumn<TData>(
  columnId: string,
  config: Omit<EditableCellProps, "value" | "rowId" | "columnId" | "isEditing" | "onStartEdit" | "onCancelEdit" | "onSave">
) {
  return {
    id: columnId,
    accessorKey: columnId,
    cell: ({ row, getValue, table }: { row: { id: string }; getValue: () => unknown; table: unknown }) => {
      // These props should be provided by the EditableTable wrapper
      const cellProps = {
        ...config,
        value: getValue(),
        rowId: row.id,
        columnId,
      } as EditableCellProps;

      return <EditableCell {...cellProps} />;
    },
  };
}

export { validateValue };
