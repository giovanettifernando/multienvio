/**
 * Types para autenticação e usuários administrativos
 */

import {
  AuthRole,
  type User as GlobalUser,
} from "@/types/contracts";

export { AuthRole };

export type User = GlobalUser;

export const ADMIN_PERMISSION_KEYS = [
  "CONTAS",
  "FINANCEIRO",
  "OPERACOES",
  "INTEGRACOES",
  "SUPORTE",
  "COLETORES",
  "PONTOS_COLETA",
  "USUARIOS",
  "CONFIGURACOES",
] as const;

export type AdminPermissionKey = typeof ADMIN_PERMISSION_KEYS[number];
export type AdminStatus = "active" | "blocked";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  status: AdminStatus;
  isSuperAdmin: boolean;
  permissions: AdminPermissionKey[];
  roles: string[];
  lastAccessAt?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserFilters {
  q?: string;
  status?: "all" | "active" | "blocked";
  permission?: AdminPermissionKey;
  /** @deprecated use permission */
  role?: AdminPermissionKey;
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
  status: AdminStatus;
  roles: string[];
}

export interface UpdateAdminUserInput {
  name?: string;
  email?: string;
  phone?: string | null;
  status?: AdminStatus;
  roles?: string[];
}

export interface ToggleStatusInput {
  status: AdminStatus;
}

export interface ResetPasswordResponse {
  message: string;
}
