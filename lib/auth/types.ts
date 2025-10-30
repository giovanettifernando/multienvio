/**
 * Types para autenticação e usuários administrativos
 */

import {
  UserStatus,
  AuthRole,
  type User as GlobalUser,
} from "@/types/contracts";

export { UserStatus, AuthRole };

export type User = GlobalUser;

/**
 * @deprecated Use User from global contracts
 */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  status: UserStatus;
  roles: string[];
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserFilters {
  q?: string;
  status?: "all" | "active" | "blocked";
  role?: string;
  page?: number;
  pageSize?: number;
  sort?: "name_asc" | "name_desc" | "updated_asc" | "updated_desc";
}

export interface AdminUserListResponse {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateAdminUserInput {
  name: string;
  email: string;
  phone?: string | null;
  status: UserStatus;
  roles: string[];
}

export interface UpdateAdminUserInput {
  name?: string;
  email?: string;
  phone?: string | null;
  status?: UserStatus;
  roles?: string[];
}

export interface ToggleStatusInput {
  status: UserStatus;
}

export interface ResetPasswordResponse {
  message: string;
}
