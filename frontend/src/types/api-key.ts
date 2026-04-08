/**
 * API Key types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/api_key.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type APIKey = components["schemas"]["APIKeyResponse"];
export type APIKeyCreated = components["schemas"]["APIKeyCreatedResponse"];
export type APIKeyListResponse = components["schemas"]["APIKeyListResponse"];
export type APIKeyCreateRequest = components["schemas"]["APIKeyCreate"];

// ---------------------------------------------------------------------------
// Frontend-only types — UI display helpers
// ---------------------------------------------------------------------------

export interface ScopeInfo {
  name: string;
  description: string;
}

export interface ScopesResponse {
  scopes: ScopeInfo[];
}

// Available scopes with descriptions (mirrors backend)
export const API_KEY_SCOPES: Record<string, string> = {
  "read:clients": "Read client information",
  "write:clients": "Create and update client information",
  "read:programs": "Read program information",
  "write:programs": "Create and update programs",
  "read:documents": "Read documents",
  "write:documents": "Upload and manage documents",
  "read:deliverables": "Read deliverables",
  "write:deliverables": "Submit and update deliverables",
  "read:partners": "Read partner information",
  "read:communications": "Read communications",
  "write:communications": "Send communications",
  "read:reports": "Generate and read reports",
  "*": "Full access to all resources",
};

// Scope categories for UI organization
export const SCOPE_CATEGORIES = {
  Clients: ["read:clients", "write:clients"],
  Programs: ["read:programs", "write:programs"],
  Documents: ["read:documents", "write:documents"],
  Deliverables: ["read:deliverables", "write:deliverables"],
  Partners: ["read:partners"],
  Communications: ["read:communications", "write:communications"],
  Reports: ["read:reports"],
  "Full Access": ["*"],
} as const;
