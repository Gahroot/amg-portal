/**
 * User roles for the AMG Portal.
 *
 * Source of truth: backend/app/models/enums.py — UserRole StrEnum
 * Keep in sync when roles are added or renamed.
 *
 * @see backend/app/models/enums.py
 */
export type UserRole =
  | 'managing_director'
  | 'relationship_manager'
  | 'coordinator'
  | 'finance_compliance'
  | 'client'
  | 'partner';

/**
 * Internal (AMG staff) roles.
 *
 * Keep in sync with `frontend/src/types/user.ts` (`INTERNAL_ROLES`) and the
 * backend source of truth at `backend/app/models/enums.py`.
 */
export const INTERNAL_ROLES: UserRole[] = [
  'managing_director',
  'relationship_manager',
  'coordinator',
  'finance_compliance',
];

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: string;
  created_at: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
}

export interface UserCreateData {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  phone_number?: string;
}

export interface UserUpdateData {
  full_name?: string;
  role?: UserRole;
  status?: string;
  phone_number?: string;
}
