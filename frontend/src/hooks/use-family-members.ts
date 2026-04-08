
import { useQuery } from "@tanstack/react-query";
import {
  listFamilyMembers,
  createFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  createFamilyRelationship,
  deleteFamilyRelationship,
} from "@/lib/api/family-members";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type {
  FamilyMemberCreate,
  FamilyMemberUpdate,
  FamilyRelationshipCreate,
} from "@/types/family-member";

export function useFamilyMembers(profileId: string) {
  return useQuery({
    queryKey: queryKeys.familyMembers.byProfile(profileId),
    queryFn: () => listFamilyMembers(profileId),
    enabled: !!profileId,
  });
}

export function useCreateFamilyMember(profileId: string) {
  return useCrudMutation({
    mutationFn: (data: FamilyMemberCreate) => createFamilyMember(profileId, data),
    invalidateKeys: [queryKeys.familyMembers.byProfile(profileId)],
    successMessage: "Family member added",
    errorMessage: "Failed to add family member",
  });
}

export function useUpdateFamilyMember(profileId: string) {
  return useCrudMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: FamilyMemberUpdate }) =>
      updateFamilyMember(memberId, data),
    invalidateKeys: [queryKeys.familyMembers.byProfile(profileId)],
    successMessage: "Family member updated",
    errorMessage: "Failed to update family member",
  });
}

export function useDeleteFamilyMember(profileId: string) {
  return useCrudMutation({
    mutationFn: (memberId: string) => deleteFamilyMember(memberId),
    invalidateKeys: [queryKeys.familyMembers.byProfile(profileId)],
    successMessage: "Family member removed",
    errorMessage: "Failed to remove family member",
  });
}

export function useCreateFamilyRelationship(profileId: string) {
  return useCrudMutation({
    mutationFn: ({
      fromMemberId,
      data,
    }: {
      fromMemberId: string;
      data: FamilyRelationshipCreate;
    }) => createFamilyRelationship(fromMemberId, data),
    invalidateKeys: [queryKeys.familyMembers.byProfile(profileId)],
    successMessage: "Relationship created",
    errorMessage: "Failed to create relationship",
  });
}

export function useDeleteFamilyRelationship(profileId: string) {
  return useCrudMutation({
    mutationFn: (relationshipId: string) => deleteFamilyRelationship(relationshipId),
    invalidateKeys: [queryKeys.familyMembers.byProfile(profileId)],
    successMessage: "Relationship removed",
    errorMessage: "Failed to remove relationship",
  });
}
