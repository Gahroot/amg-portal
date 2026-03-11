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

export interface FamilyMember {
  id: string;
  client_profile_id: string;
  name: string;
  relationship_type: FamilyRelationshipType;
  date_of_birth: string | null;
  occupation: string | null;
  notes: string | null;
  is_primary_contact: boolean;
  created_at: string;
  updated_at: string;
}

export interface FamilyMemberCreate {
  name: string;
  relationship_type: FamilyRelationshipType;
  date_of_birth?: string;
  occupation?: string;
  notes?: string;
  is_primary_contact?: boolean;
}

export type FamilyMemberUpdate = Partial<FamilyMemberCreate>;

export interface FamilyMemberListResponse {
  family_members: FamilyMember[];
  total: number;
}

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
