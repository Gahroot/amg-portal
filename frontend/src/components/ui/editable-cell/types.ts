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
  onSave?: (
    rowId: string,
    columnId: string,
    value: unknown,
  ) => Promise<ValidationResult | void> | ValidationResult | void;
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
export const defaultFormatters: Record<string, (value: unknown) => string> = {
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
