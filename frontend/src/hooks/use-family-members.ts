"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listFamilyMembers,
  createFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  createFamilyRelationship,
  deleteFamilyRelationship,
} from "@/lib/api/family-members";
import type {
  FamilyMemberCreate,
  FamilyMemberUpdate,
  FamilyRelationshipCreate,
} from "@/types/family-member";

export function useFamilyMembers(profileId: string) {
  return useQuery({
    queryKey: ["family-members", profileId],
    queryFn: () => listFamilyMembers(profileId),
    enabled: !!profileId,
  });
}

export function useCreateFamilyMember(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: FamilyMemberCreate) => createFamilyMember(profileId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family-members", profileId] });
      toast.success("Family member added");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to add family member"),
  });
}

export function useUpdateFamilyMember(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: FamilyMemberUpdate }) =>
      updateFamilyMember(memberId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family-members", profileId] });
      toast.success("Family member updated");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update family member"),
  });
}

export function useDeleteFamilyMember(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => deleteFamilyMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family-members", profileId] });
      toast.success("Family member removed");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to remove family member"),
  });
}

export function useCreateFamilyRelationship(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      fromMemberId,
      data,
    }: {
      fromMemberId: string;
      data: FamilyRelationshipCreate;
    }) => createFamilyRelationship(fromMemberId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family-members", profileId] });
      toast.success("Relationship created");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create relationship"),
  });
}

export function useDeleteFamilyRelationship(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (relationshipId: string) => deleteFamilyRelationship(relationshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family-members", profileId] });
      toast.success("Relationship removed");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to remove relationship"),
  });
}
