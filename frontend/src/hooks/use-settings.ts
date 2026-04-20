
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  updateProfile,
  getNotificationPreferences,
  updateNotificationPreferences,
  changePassword,
} from "@/lib/api/auth";
import {
  getClientPreferences,
  updateClientPreferences,
  type ClientPreferencesUpdate,
} from "@/lib/api/client-portal";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type {
  ProfileUpdateRequest,
  UserNotificationPreferencesUpdate,
  ChangePasswordRequest,
} from "@/types/user";

export function useNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.settings.notificationPreferences(),
    queryFn: getNotificationPreferences,
  });
}

export function useUpdateNotificationPreferences() {
  return useCrudMutation({
    mutationFn: (data: UserNotificationPreferencesUpdate) =>
      updateNotificationPreferences(data),
    invalidateKeys: [queryKeys.settings.notificationPreferences()],
    successMessage: "Notification preferences updated",
    errorMessage: "Failed to update preferences",
  });
}

export function useUpdateProfile() {
  return useCrudMutation({
    mutationFn: (data: ProfileUpdateRequest) => updateProfile(data),
    invalidateKeys: [queryKeys.users.current()],
    successMessage: "Profile updated",
    errorMessage: "Failed to update profile",
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordRequest) => changePassword(data),
    onSuccess: () => {
      toast.success("Password changed successfully");
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Failed to change password";
      toast.error(message);
    },
  });
}

export function useClientPreferences() {
  return useQuery({
    queryKey: queryKeys.settings.clientPreferences(),
    queryFn: getClientPreferences,
  });
}

export function useUpdateClientPreferences() {
  return useCrudMutation({
    mutationFn: (data: ClientPreferencesUpdate) => updateClientPreferences(data),
    invalidateKeys: [queryKeys.settings.clientPreferences()],
    successMessage: "Communication preferences updated",
    errorMessage: "Failed to update preferences",
  });
}
