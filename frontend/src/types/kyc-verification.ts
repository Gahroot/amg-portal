import type { DocumentItem } from "@/types/document";

export type KYCDocumentType =
  | "passport"
  | "national_id"
  | "proof_of_address"
  | "tax_id"
  | "bank_statement"
  | "source_of_wealth"
  | "other";

export type KYCVerificationStatus = "pending" | "verified" | "expired" | "rejected";

export interface KYCVerification {
  id: string;
  client_id: string;
  document_id: string;
  document_type: KYCDocumentType;
  status: KYCVerificationStatus;
  expiry_date: string | null;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  document: DocumentItem | null;
  client_name: string | null;
}

export interface KYCVerificationListResponse {
  kyc_documents: KYCVerification[];
  total: number;
}

export interface KYCVerifyRequest {
  status: "verified" | "rejected";
  rejection_reason?: string;
  notes?: string;
}

export interface KYCVerificationListParams {
  status?: string;
  client_id?: string;
  date_from?: string;
  date_to?: string;
  skip?: number;
  limit?: number;
}

export interface KYCExpiringListParams {
  days?: number;
  skip?: number;
  limit?: number;
}
