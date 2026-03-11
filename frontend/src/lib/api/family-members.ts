import api from "@/lib/api";
import type {
  FamilyMember,
  FamilyMemberCreate,
  FamilyMemberUpdate,
  FamilyMemberListResponse,
  FamilyRelationship,
  FamilyRelationshipCreate,
} from "@/types/family-member";

export async function listFamilyMembers(
  profileId: string
): Promise<FamilyMemberListResponse> {
  const response = await api.get<FamilyMemberListResponse>(
    `/api/v1/clients/${profileId}/family-members`
  );
  return response.data;
}

export async function createFamilyMember(
  profileId: string,
  data: FamilyMemberCreate
): Promise<FamilyMember> {
  const response = await api.post<FamilyMember>(
    `/api/v1/clients/${profileId}/family-members`,
    data
  );
  return response.data;
}

export async function updateFamilyMember(
  memberId: string,
  data: FamilyMemberUpdate
): Promise<FamilyMember> {
  const response = await api.patch<FamilyMember>(
    `/api/v1/family-members/${memberId}`,
    data
  );
  return response.data;
}

export async function deleteFamilyMember(memberId: string): Promise<void> {
  await api.delete(`/api/v1/family-members/${memberId}`);
}

export async function createFamilyRelationship(
  fromMemberId: string,
  data: FamilyRelationshipCreate
): Promise<FamilyRelationship> {
  const response = await api.post<FamilyRelationship>(
    `/api/v1/family-members/${fromMemberId}/relationships`,
    data
  );
  return response.data;
}

export async function deleteFamilyRelationship(
  relationshipId: string
): Promise<void> {
  await api.delete(`/api/v1/family-members/relationships/${relationshipId}`);
}
