/**
 * Document types — re-exported from generated OpenAPI types where possible.
 *
 * API types are sourced from generated.ts (auto-generated from FastAPI OpenAPI schema).
 * Frontend-only types (enums, query params, display types) remain manual.
 *
 * To refresh: npm run generate:types (requires backend at localhost:8000)
 *
 * @see backend/app/schemas/document.py
 * @see backend/app/schemas/document_request.py
 * @see backend/app/schemas/kyc_document.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type DocumentItem = components["schemas"]["DocumentResponse"];
export type DocumentListResponse = components["schemas"]["DocumentListResponse"];
export type DocumentVersionItem = components["schemas"]["DocumentVersionResponse"];
export type DocumentVersionListResponse = components["schemas"]["DocumentVersionListResponse"];
export type DocumentDiffHunk = components["schemas"]["DocumentDiffHunk"];
export type DocumentCompareResponse = components["schemas"]["DocumentCompareResponse"];
export type DocumentRequestItem = components["schemas"]["DocumentRequestResponse"];
export type DocumentRequestListResponse = components["schemas"]["DocumentRequestListResponse"];
export type DocumentRequestCreate = components["schemas"]["DocumentRequestCreate"];
export type DocumentRequestUpdate = components["schemas"]["DocumentRequestUpdate"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums, KYC types, query params
// ---------------------------------------------------------------------------

export type DocumentEntityType = "client" | "program" | "deliverable" | "partner";
export type DocumentCategory = "general" | "contract" | "report" | "correspondence" | "compliance" | "financial" | "legal" | "other";
export type DocumentRequestStatus =
  | "pending"
  | "in_progress"
  | "received"
  | "processing"
  | "complete"
  | "cancelled"
  | "overdue";
export type DocumentRequestType =
  | "passport"
  | "national_id"
  | "proof_of_address"
  | "bank_statement"
  | "tax_return"
  | "source_of_wealth"
  | "financial_statement"
  | "corporate_documents"
  | "contract"
  | "signed_agreement"
  | "insurance_certificate"
  | "other";
export type DocumentType = "passport" | "visa" | "certification" | "other";
export type ExpiryStatus = "expired" | "expiring_30" | "expiring_90" | "valid";
export type KYCDocumentType = "passport" | "national_id" | "proof_of_address" | "tax_id" | "bank_statement" | "source_of_wealth" | "other";
export type KYCDocumentStatus = "pending" | "verified" | "expired" | "rejected";

export interface ExpiringDocumentItem {
  id: string;
  file_name: string;
  file_size: number;
  entity_type: string;
  entity_id: string;
  category: string;
  description: string | null;
  document_type: DocumentType | null;
  expiry_date: string;
  expiry_status: ExpiryStatus;
  days_until_expiry: number;
  uploaded_by: string;
  created_at: string;
  download_url: string | null;
}

export interface ExpiringDocumentsResponse {
  documents: ExpiringDocumentItem[];
  total: number;
  expired_count: number;
  expiring_30_count: number;
  expiring_90_count: number;
}

export interface KYCDocumentItem {
  id: string;
  client_id: string;
  document_id: string;
  document_type: string;
  status: string;
  expiry_date: string | null;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  document: DocumentItem | null;
}

export interface KYCDocumentListResponse {
  kyc_documents: KYCDocumentItem[];
  total: number;
}

export interface KYCVerifyData {
  status: "verified" | "rejected";
  rejection_reason?: string;
  notes?: string;
}

export type DiffChangeType = "added" | "deleted" | "context";

export interface DiffLine {
  line_number_a: number | null;
  line_number_b: number | null;
  content: string;
  change_type: DiffChangeType;
}
