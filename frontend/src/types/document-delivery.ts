/**
 * Document delivery types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/document_delivery.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type DocumentDeliveryRecord = components["schemas"]["DocumentDeliveryResponse"];
export type DocumentDeliveryListResponse = components["schemas"]["DocumentDeliveryListResponse"];

// ---------------------------------------------------------------------------
// Frontend-only types — request shapes, display helpers
// ---------------------------------------------------------------------------

export type VaultStatus = "active" | "archived" | "sealed";
export type DeliveryMethod = "portal" | "email" | "secure_link";

export interface DeliverDocumentRequest {
  recipient_ids: string[];
  delivery_method: DeliveryMethod;
  notes?: string;
}

export interface SecureLinkRequest {
  recipient_id: string;
  expires_hours?: number;
}

export interface SecureLinkResponse {
  token: string;
  download_url: string;
  expires_at: string;
}

export interface SealDocumentRequest {
  retention_policy?: string;
}

export interface CustodyEntry {
  action: string;
  user_id: string;
  timestamp: string;
  details: string | null;
}

export interface CustodyChainResponse {
  document_id: string;
  file_name: string;
  vault_status: VaultStatus;
  entries: CustodyEntry[];
  total: number;
}

export interface VaultDocument {
  id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  content_type: string | null;
  entity_type: string;
  entity_id: string;
  category: string;
  description: string | null;
  version: number;
  uploaded_by: string;
  vault_status: VaultStatus;
  sealed_at: string | null;
  sealed_by: string | null;
  retention_policy: string | null;
  created_at: string;
  updated_at: string;
  download_url: string | null;
}

export interface VaultDocumentListResponse {
  documents: VaultDocument[];
  total: number;
}
