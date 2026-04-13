/**
 * Narrow-union type guards for backend strings.
 *
 * Backend OpenAPI schemas expose most enums as `string` in generated.ts, but
 * the frontend types them as narrow literal unions. These helpers let call
 * sites narrow a `string` into its literal type before indexing a
 * Record<LiteralUnion, ...> or passing to a function that expects the
 * narrower type.
 */

import type { ExpiryStatus } from "@/types/document";
import type {
  NPSFollowUpPriority,
  NPSFollowUpStatus,
  NPSScoreCategory,
} from "@/types/nps-survey";
import type { CapacityStatus } from "@/types/partner";

const EXPIRY_STATUSES = ["valid", "expiring_90", "expiring_30", "expired"] as const;
export const isExpiryStatus = (v: string): v is ExpiryStatus =>
  (EXPIRY_STATUSES as readonly string[]).includes(v);

const NPS_SCORE_CATEGORIES = ["detractor", "passive", "promoter"] as const;
export const isNPSScoreCategory = (v: string): v is NPSScoreCategory =>
  (NPS_SCORE_CATEGORIES as readonly string[]).includes(v);

const NPS_FOLLOW_UP_STATUSES = [
  "pending",
  "acknowledged",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export const isNPSFollowUpStatus = (v: string): v is NPSFollowUpStatus =>
  (NPS_FOLLOW_UP_STATUSES as readonly string[]).includes(v);

const NPS_FOLLOW_UP_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const isNPSFollowUpPriority = (v: string): v is NPSFollowUpPriority =>
  (NPS_FOLLOW_UP_PRIORITIES as readonly string[]).includes(v);

const CAPACITY_STATUSES = ["available", "partial", "full", "blocked"] as const;
export const isCapacityStatus = (v: string): v is CapacityStatus =>
  (CAPACITY_STATUSES as readonly string[]).includes(v);
