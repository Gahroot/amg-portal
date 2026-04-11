/**
 * Family member types — re-exported from generated OpenAPI types where possible.
 *
 * @see backend/app/schemas/family_member.py
 */
import type { components } from "./generated";

// ---------------------------------------------------------------------------
// API types — re-exported from generated OpenAPI schema
// ---------------------------------------------------------------------------

export type FamilyMember = components["schemas"]["FamilyMemberResponse"];
export type FamilyMemberListResponse = components["schemas"]["FamilyMemberListResponse"];
export type FamilyMemberCreate = components["schemas"]["FamilyMemberCreate"];
export type FamilyMemberUpdate = components["schemas"]["FamilyMemberUpdate"];
export type FamilyRelationship = components["schemas"]["FamilyRelationshipResponse"];
export type FamilyRelationshipCreate = components["schemas"]["FamilyRelationshipCreate"];

// ---------------------------------------------------------------------------
// Frontend-only types — enums
// ---------------------------------------------------------------------------

export type FamilyRelationshipType =
  | "spouse"
  | "partner"
  | "child"
  | "parent"
  | "sibling"
  | "grandparent"
  | "grandchild"
  | "aunt_uncle"
  | "cousin"
  | "in_law"
  | "other";
