export type DocumentEntityType = "client" | "program" | "deliverable" | "partner";
export type DocumentCategory = "general" | "contract" | "report" | "correspondence" | "compliance" | "financial" | "legal" | "other";
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
}

export interface DocumentListResponse {
  documents: DocumentItem[];
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

export type EnvelopeStatus =
  | "created"
  | "sent"
  | "delivered"
  | "signed"
  | "completed"
  | "declined"
  | "voided"
  | "expired";

export interface EnvelopeRecipient {
  name: string;
  email: string;
  status: string;
  signed_at: string | null;
  declined_reason: string | null;
}

export interface EnvelopeItem {
  id: string;
  envelope_id: string;
  subject: string;
  status: EnvelopeStatus;
  sender_name: string;
  sender_email: string;
  recipients: EnvelopeRecipient[];
  sent_at: string | null;
  completed_at: string | null;
  voided_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnvelopeListResponse {
  envelopes: EnvelopeItem[];
  total: number;
}

export interface EnvelopeSigningSession {
  signing_url: string;
  integration_key: string;
  sandbox: boolean;
}
