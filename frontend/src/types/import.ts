// Data Import Types

export type ImportEntityType = "clients" | "partners" | "programs" | "tasks";

export type ImportStatus =
  | "pending"
  | "validating"
  | "mapping"
  | "preview"
  | "importing"
  | "completed"
  | "failed";

export interface ColumnMapping {
  source_column: string;
  target_field: string;
  transform?: string | null;
}

export interface ImportError {
  row_number: number;
  column?: string | null;
  field?: string | null;
  error_type: "required" | "format" | "duplicate" | "reference" | "value";
  message: string;
  value?: unknown;
}

export interface ImportWarning {
  row_number: number;
  column?: string | null;
  field?: string | null;
  warning_type: "duplicate_match" | "similar_existing" | "missing_optional";
  message: string;
  value?: unknown;
  existing_id?: string;
  existing_name?: string;
}

export interface ImportPreviewRow {
  row_number: number;
  data: Record<string, unknown>;
  mapped_data: Record<string, unknown>;
  is_valid: boolean;
  errors: ImportError[];
  warnings: ImportWarning[];
}

export interface ImportFieldDefinition {
  name: string;
  display_name: string;
  description?: string | null;
  required: boolean;
  field_type: "string" | "email" | "phone" | "date" | "number" | "enum" | "uuid";
  enum_values?: string[] | null;
  default_value?: unknown;
  validation_regex?: string | null;
  example_values: string[];
}

export interface ImportTemplate {
  entity_type: ImportEntityType;
  fields: ImportFieldDefinition[];
  example_rows: Record<string, unknown>[];
  csv_headers: string[];
}

export interface ImportUploadResponse {
  import_id: string;
  filename: string;
  row_count: number;
  columns: string[];
  detected_mappings?: Record<string, string> | null;
  status: ImportStatus;
}

export interface ImportValidateResponse {
  import_id: string;
  status: ImportStatus;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  rows_with_warnings: number;
  errors: ImportError[];
  warnings: ImportWarning[];
  preview_rows: ImportPreviewRow[];
}

export interface ImportConfirmResponse {
  import_id: string;
  status: ImportStatus;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  failed_rows: number;
  created_ids: string[];
  errors: ImportError[];
}

export interface ImportJobResponse {
  import_id: string;
  entity_type: ImportEntityType;
  filename: string;
  status: ImportStatus;
  created_at: string;
  updated_at: string;
  total_rows?: number | null;
  valid_rows?: number | null;
  invalid_rows?: number | null;
  imported_rows?: number | null;
  errors: ImportError[];
  warnings: ImportWarning[];
  mappings: ColumnMapping[];
}

export interface ImportJobListResponse {
  jobs: ImportJobResponse[];
  total: number;
}

// Step types for wizard
export type ImportWizardStep = "upload" | "mapping" | "validation" | "preview" | "complete";

export const WIZARD_STEPS: { id: ImportWizardStep; title: string; description: string }[] = [
  { id: "upload", title: "Upload", description: "Select your file" },
  { id: "mapping", title: "Map Columns", description: "Match columns to fields" },
  { id: "validation", title: "Validate", description: "Check for errors" },
  { id: "preview", title: "Preview", description: "Review results" },
  { id: "complete", title: "Complete", description: "Import finished" },
];

// Entity type labels
export const ENTITY_TYPE_LABELS: Record<ImportEntityType, string> = {
  clients: "Clients",
  partners: "Partners",
  programs: "Programs",
  tasks: "Tasks",
};

export const ENTITY_TYPE_DESCRIPTIONS: Record<ImportEntityType, string> = {
  clients: "Import client profiles with contact information and preferences",
  partners: "Import partner firms and their contact details",
  programs: "Import programs linked to existing clients",
  tasks: "Import tasks (requires existing programs)",
};
