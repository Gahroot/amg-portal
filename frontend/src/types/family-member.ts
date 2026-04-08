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

// ---------------------------------------------------------------------------
// Frontend-only types — enums, update shapes
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

export type FamilyMemberUpdate = Partial<FamilyMemberCreate>;

export interface FamilyRelationship {
  id: string;
  from_member_id: string;
  to_member_id: string;
  relationship_type: string;
  created_at: string;
}

export interface FamilyRelationshipCreate {
  to_member_id: string;
  relationship_type: string;
}
