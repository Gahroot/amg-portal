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
export type SecureLinkRequest = components["schemas"]["SecureLinkRequest"];
export type SecureLinkResponse = components["schemas"]["SecureLinkResponse"];
export type SealDocumentRequest = components["schemas"]["SealDocumentRequest"];
export type CustodyEntry = components["schemas"]["CustodyEntry"];
export type CustodyChainResponse = components["schemas"]["CustodyChainResponse"];
export type VaultDocument = components["schemas"]["VaultDocumentResponse"];
export type VaultDocumentListResponse = components["schemas"]["VaultDocumentListResponse"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums, request shapes
// ---------------------------------------------------------------------------

export type VaultStatus = "active" | "archived" | "sealed";
export type DeliveryMethod = "portal" | "email" | "secure_link";

export interface DeliverDocumentRequest {
  recipient_ids: string[];
  delivery_method: DeliveryMethod;
  notes?: string;
}
