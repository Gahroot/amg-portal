"use client";

import { Badge } from "@/components/ui/badge";
import type { KYCDocumentType } from "@/types/kyc-verification";

const DOCUMENT_TYPE_LABELS: Record<KYCDocumentType, string> = {
  passport: "Passport",
  national_id: "National ID",
  proof_of_address: "Proof of Address",
  tax_id: "Tax ID",
  bank_statement: "Bank Statement",
  source_of_wealth: "Source of Wealth",
  other: "Other",
};

interface DocumentTypeBadgeProps {
  type: KYCDocumentType;
}

export function DocumentTypeBadge({ type }: DocumentTypeBadgeProps) {
  const label = DOCUMENT_TYPE_LABELS[type] ?? type;
  return <Badge variant="secondary">{label}</Badge>;
}

export function getDocumentTypeLabel(type: KYCDocumentType): string {
  return DOCUMENT_TYPE_LABELS[type] ?? type;
}
