/**
 * Data import types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/import_schemas.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type ImportEntityType = components["schemas"]["ImportEntityType"];
export type ImportStatus = components["schemas"]["ImportStatus"];
export type ImportError = components["schemas"]["ImportError"];
export type ImportWarning = components["schemas"]["ImportWarning"];
export type ImportFieldDefinition = components["schemas"]["ImportFieldDefinition"];
export type ImportPreviewRow = components["schemas"]["ImportPreviewRow"];
export type ImportValidateResponse = components["schemas"]["ImportValidateResponse"];
export type ImportConfirmResponse = components["schemas"]["ImportConfirmResponse"];
export type ImportJobResponse = components["schemas"]["ImportJobResponse"];
export type ImportJobListResponse = components["schemas"]["ImportJobListResponse"];
export type ImportTemplate = components["schemas"]["ImportTemplateResponse"];

// ---------------------------------------------------------------------------
// Frontend-only types — wizard steps, upload response, constants
// ---------------------------------------------------------------------------

export interface ColumnMapping {
  source_column: string;
  target_field: string;
  transform?: string | null;
}

export interface ImportUploadResponse {
  import_id: string;
  filename: string;
  row_count: number;
  columns: string[];
  detected_mappings?: Record<string, string> | null;
  status: ImportStatus;
}

export type ImportWizardStep = "upload" | "mapping" | "validation" | "preview" | "complete";

export const WIZARD_STEPS: { id: ImportWizardStep; title: string; description: string }[] = [
  { id: "upload", title: "Upload", description: "Select your file" },
  { id: "mapping", title: "Map Columns", description: "Match columns to fields" },
  { id: "validation", title: "Validate", description: "Check for errors" },
  { id: "preview", title: "Preview", description: "Review results" },
  { id: "complete", title: "Complete", description: "Import finished" },
];

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
