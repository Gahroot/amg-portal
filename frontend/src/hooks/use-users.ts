
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
} from "@/lib/api/users";
import { queryKeys } from "@/lib/query-keys";
import { useCrudMutation } from "@/hooks/use-crud-mutations";
import type {
  UserListParams,
  UserCreateData,
  UserUpdateData,
} from "@/lib/api/users";

export function useUsers(params?: UserListParams) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => listUsers(params),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => getUser(id),
    enabled: !!id,
  });
}

export function useCreateUser() {
  return useCrudMutation({
    mutationFn: (data: UserCreateData) => createUser(data),
    invalidateKeys: [queryKeys.users.all],
    errorMessage: "Failed to create user",
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UserUpdateData }) =>
      updateUser(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(variables.id) });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update user"),
  });
}
