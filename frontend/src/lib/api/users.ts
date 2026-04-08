import type {
  User,
  UserCreateData,
  UserUpdateData,
  UserListResponse,
  UserListParams,
} from "@/types/user";
import { createApiClient } from "./factory";

// Re-export types for convenience
export type {
  User,
  UserCreateData,
  UserUpdateData,
  UserListResponse,
  UserListParams,
};

const usersApi = createApiClient<User, UserListResponse, UserCreateData, UserUpdateData>(
  "/api/v1/users/"
);

export const listUsers = usersApi.list as (params?: UserListParams) => Promise<UserListResponse>;
export const getUser = usersApi.get;
export const createUser = usersApi.create;
export const updateUser = usersApi.update;
export const deleteUser = usersApi.delete;
