"use client";

import { Badge } from "@/components/ui/badge";
import type { KYCVerificationStatus } from "@/types/kyc-verification";

const STATUS_CONFIG: Record<
  KYCVerificationStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Pending", variant: "outline" },
  verified: { label: "Verified", variant: "default" },
  expired: { label: "Expired", variant: "secondary" },
  rejected: { label: "Rejected", variant: "destructive" },
};

interface VerificationStatusBadgeProps {
  status: KYCVerificationStatus;
}

export function VerificationStatusBadge({ status }: VerificationStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    variant: "outline" as const,
  };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
