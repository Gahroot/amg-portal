
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserNotificationPreferencesUpdate) =>
      updateNotificationPreferences(data),
    onSuccess: () => {
      toast.success("Notification preferences updated");
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.notificationPreferences() });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Failed to update preferences";
      toast.error(message);
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProfileUpdateRequest) => updateProfile(data),
    onSuccess: () => {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: queryKeys.users.current() });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Failed to update profile";
      toast.error(message);
    },
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ClientPreferencesUpdate) => updateClientPreferences(data),
    onSuccess: () => {
      toast.success("Communication preferences updated");
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.clientPreferences() });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Failed to update preferences";
      toast.error(message);
    },
  });
}
