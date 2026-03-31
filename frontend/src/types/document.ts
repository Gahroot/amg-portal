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

export interface DocumentItem {
  id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  content_type: string;
  entity_type: string;
  entity_id: string;
  category: string;
  description: string | null;
  version: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  download_url: string | null;
  // Expiry fields
  document_type: DocumentType | null;
  expiry_date: string | null;       // ISO date string e.g. "2026-08-15"
  expiry_status: ExpiryStatus | null;
  // DocuSign
  envelope_id: string | null;
  docusign_status: string | null;
}

export interface ExpiringDocumentItem {
  id: string;
  file_name: string;
  file_size: number;
  entity_type: string;
  entity_id: string;
  category: string;
  description: string | null;
  document_type: DocumentType | null;
  expiry_date: string;              // ISO date string, always present
  expiry_status: ExpiryStatus;
  days_until_expiry: number;        // negative if already expired
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

export interface DocumentListResponse {
  documents: DocumentItem[];
  total: number;
}

export interface DocumentVersionItem {
  id: string;
  version: number;
  uploaded_by: string;
  created_at: string;
  file_size: number;
  download_url: string | null;
}

export interface DocumentVersionListResponse {
  versions: DocumentVersionItem[];
  total: number;
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

export interface DocumentDiffHunk {
  a_start: number;
  a_count: number;
  b_start: number;
  b_count: number;
  lines: DiffLine[];
}

export interface DocumentCompareResponse {
  version_a: DocumentVersionItem;
  version_b: DocumentVersionItem;
  is_text: boolean;
  diff_available: boolean;
  hunks: DocumentDiffHunk[];
  total_additions: number;
  total_deletions: number;
  metadata: Record<string, unknown> | null;
}

export interface DocumentRequestItem {
  id: string;
  client_id: string;
  requested_by: string;
  document_type: DocumentRequestType;
  title: string;
  description: string | null;
  message: string | null;
  status: DocumentRequestStatus;
  deadline: string | null;
  estimated_completion: string | null;
  requested_at: string;
  in_progress_at: string | null;
  received_at: string | null;
  processing_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  rm_notes: string | null;
  client_notes: string | null;
  fulfilled_document_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentRequestListResponse {
  requests: DocumentRequestItem[];
  total: number;
}

export interface DocumentRequestCreate {
  client_id: string;
  document_type: DocumentRequestType;
  title: string;
  description?: string;
  message?: string;
  deadline?: string | null;
}

export interface DocumentRequestUpdate {
  title?: string;
  description?: string;
  message?: string;
  deadline?: string | null;
  status?: DocumentRequestStatus;
}
