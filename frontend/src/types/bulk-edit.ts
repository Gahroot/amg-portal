/**
 * Types for bulk edit operations across data tables.
 */

/**
 * Definition of an editable field in bulk edit operations.
 */
export interface BulkEditField<T = unknown> {
  /** Field key/name matching the data model */
  key: string;
  /** Display label for the field */
  label: string;
  /** Field type determining the input widget */
  type:
    | "text"
    | "number"
    | "select"
    | "date"
    | "boolean"
    | "user"
    | "multiselect";
  /** For select/multiselect types: available options */
  options?: { value: string; label: string }[];
  /** Whether this field can be cleared (set to null/empty) */
  clearable?: boolean;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Custom validation function */
  validate?: (value: T) => string | null;
  /** Transform value before sending to API */
  transform?: (value: T) => unknown;
  /** Help text shown below the input */
  helpText?: string;
}

/**
 * Result of a bulk edit operation.
 */
export interface BulkEditResult {
  /** Number of records successfully updated */
  updated: number;
  /** Number of records successfully deleted (if delete operation) */
  deleted: number;
  /** Records that failed to update/delete with error messages */
  failed: BulkEditFailure[];
}

/**
 * Details of a single failed bulk edit operation.
 */
export interface BulkEditFailure {
  /** ID of the record that failed */
  id: string;
  /** Error message explaining the failure */
  error: string;
}

/**
 * Payload for bulk update API requests.
 */
export interface BulkEditPayload<T = unknown> {
  /** IDs of records to update */
  ids: string[];
  /** Field to update */
  field: string;
  /** New value for the field */
  value: T;
  /** Whether to clear the field (set to null) */
  clear?: boolean;
  /** Whether this is a delete operation */
  delete?: boolean;
}

/**
 * Configuration for bulk edit dialog.
 */
export interface BulkEditConfig<TRecord> {
  /** Fields available for bulk editing */
  fields: BulkEditField[];
  /** Function to get unique ID from a record */
  getRowId: (record: TRecord) => string;
  /** Function to get display name for a record (shown in preview) */
  getRowLabel?: (record: TRecord) => string;
  /** API endpoint for bulk update (POST request) */
  endpoint: string;
  /** Custom payload builder (optional, defaults to standard format) */
  buildPayload?: (
    ids: string[],
    field: string,
    value: unknown,
    clear: boolean
  ) => BulkEditPayload;
  /** Callback after successful bulk edit */
  onSuccess?: (result: BulkEditResult) => void;
  /** Callback after failed bulk edit */
  onError?: (error: Error) => void;
  /** Whether to show delete option */
  enableDelete?: boolean;
  /** Custom delete confirmation message */
  deleteConfirmMessage?: string;
  /** Max records to show in preview */
  maxPreviewRows?: number;
}

/**
 * State of the bulk edit dialog.
 */
export interface BulkEditState<TRecord> {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Currently selected field to edit */
  selectedField: BulkEditField | null;
  /** New value for the field */
  newValue: unknown;
  /** Whether to clear the field */
  clearValue: boolean;
  /** Records selected for bulk edit */
  selectedRecords: TRecord[];
  /** Whether an operation is in progress */
  isSubmitting: boolean;
  /** Current step: "select" | "preview" | "confirm" */
  step: "select" | "preview" | "confirm";
}
