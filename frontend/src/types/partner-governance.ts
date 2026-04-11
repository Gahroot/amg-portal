/**
 * Partner governance types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/partner_governance.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type GovernanceAction = components["schemas"]["GovernanceActionResponse"];
export type GovernanceActionCreate = components["schemas"]["GovernanceActionCreate"];
export type GovernanceHistoryResponse = components["schemas"]["GovernanceHistoryResponse"];
export type GovernanceDashboardResponse = components["schemas"]["GovernanceDashboardResponse"];
export type GovernanceDashboardEntry = components["schemas"]["GovernanceDashboardEntry"];
export type CompositeScore = components["schemas"]["CompositeScoreResponse"];

// ---------------------------------------------------------------------------
// Frontend-only types — display enums
// ---------------------------------------------------------------------------

export type GovernanceActionType =
  | "warning"
  | "probation"
  | "suspension"
  | "termination"
  | "reinstatement";
