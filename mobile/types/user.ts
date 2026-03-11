export type UserRole =
  | 'managing_director'
  | 'relationship_manager'
  | 'coordinator'
  | 'finance_compliance'
  | 'client'
  | 'partner';

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
