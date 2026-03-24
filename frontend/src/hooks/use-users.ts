
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
} from "@/lib/api/users";
import type {
  UserListParams,
  UserCreateData,
  UserUpdateData,
} from "@/lib/api/users";

export function useUsers(params?: UserListParams) {
  return useQuery({
    queryKey: ["users", params],
    queryFn: () => listUsers(params),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ["users", id],
    queryFn: () => getUser(id),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserCreateData) => createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create user"),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UserUpdateData }) =>
      updateUser(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["users", variables.id] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update user"),
  });
}
