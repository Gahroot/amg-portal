/**
 * API Key types for programmatic API access management.
 */

export interface ScopeInfo {
  name: string;
  description: string;
}

export interface ScopesResponse {
  scopes: ScopeInfo[];
}

export interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface APIKeyCreated extends APIKey {
  key: string;
  warning: string;
}

export interface APIKeyListResponse {
  items: APIKey[];
  total: number;
}

export interface APIKeyCreateRequest {
  name: string;
  scopes: string[];
  expires_in_days?: number | null;
  rate_limit?: number | null;
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
