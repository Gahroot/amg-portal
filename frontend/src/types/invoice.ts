/**
 * Invoice types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/invoice.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type Invoice = components["schemas"]["InvoiceResponse"];
export type InvoiceListResponse = components["schemas"]["InvoiceListResponse"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums, query params
// ---------------------------------------------------------------------------

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface InvoiceListParams {
  skip?: number;
  limit?: number;
  client_id?: string;
  program_id?: string;
  status?: string;
}
