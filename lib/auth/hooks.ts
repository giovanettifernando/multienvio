/**
 * React Query hooks para gestão de usuários admin
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App } from "antd";
import { adminUsersKeys } from "./queryKeys";
import type {
  AdminPermissionKey,
  AdminStatus,
  AdminUser,
  AdminUserFilters,
  AdminUserListResponse,
  CreateAdminUserInput,
  ResetPasswordResponse,
  ToggleStatusInput,
  UpdateAdminUserInput,
} from "./types";
import {
  ROLE_GROUPS,
  isSuperAdminRole,
  normalizeRoles,
  permissionToRoleKey,
  roleKeyToPermission,
} from "./roles";
import type { RoleGroup } from "./roles";
import { ADMIN_PERMISSION_KEYS } from "./types";

const API_BASE = "/api/admin/staff/users";
const ADMIN_PERMISSION_SET = new Set<AdminPermissionKey>(
  ADMIN_PERMISSION_KEYS as ReadonlyArray<AdminPermissionKey>,
);

function mapStatusToDb(status: AdminStatus): "ACTIVE" | "BLOCKED" {
  return status === "active" ? "ACTIVE" : "BLOCKED";
}

function mapStatusFromDb(status: string | null | undefined): AdminStatus {
  return status === "BLOCKED" ? "blocked" : "active";
}

function mapRolesToPayload(roles: string[]): {
  isSuperAdmin: boolean;
  permissions: AdminPermissionKey[];
} {
  const normalized = normalizeRoles(roles);
  const isSuperAdmin = normalized.some(isSuperAdminRole);
  const permissions = normalized
    .map((role) => roleKeyToPermission(role))
    .filter((perm): perm is AdminPermissionKey => Boolean(perm));

  return {
    isSuperAdmin,
    permissions,
  };
}

type RawStaffUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  status?: string | null;
  isSuperAdmin?: boolean;
  permissions?: string[] | null;
  lastAccessAt?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapUserResponse(data: RawStaffUser): AdminUser {
  const status = mapStatusFromDb(data.status ?? null);
  const isSuperAdmin = Boolean(data.isSuperAdmin);
  const rawPermissions = Array.isArray(data.permissions) ? data.permissions : [];
  const permissions: AdminPermissionKey[] = isSuperAdmin
    ? [...ADMIN_PERMISSION_KEYS]
    : rawPermissions.filter((perm): perm is AdminPermissionKey =>
        ADMIN_PERMISSION_SET.has(perm as AdminPermissionKey),
      );

  const roles = isSuperAdmin
    ? normalizeRoles(["admin.super", ...permissions.map(permissionToRoleKey)])
    : normalizeRoles(permissions.map(permissionToRoleKey));

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    phone: data.phone ?? null,
    status,
    isSuperAdmin,
    permissions,
    roles,
    lastAccessAt: data.lastAccessAt ?? data.lastLoginAt ?? null,
    lastLoginAt: data.lastLoginAt ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

async function fetchUsers(filters?: AdminUserFilters): Promise<AdminUserListResponse> {
  const params = new URLSearchParams();

  if (filters?.q) params.set("q", filters.q);
  if (filters?.status && filters.status !== "all") params.set("status", filters.status);
  if (filters?.permission) params.set("permission", filters.permission);
  if (filters?.page) params.set("page", filters.page.toString());
  if (filters?.pageSize) params.set("pageSize", filters.pageSize.toString());
  if (filters?.sort) params.set("sort", filters.sort);

  const res = await fetch(`${API_BASE}?${params.toString()}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Erro ao carregar usuários");
  }

  const payload = await res.json();
  const rawItems = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.users)
    ? payload.users
    : [];
  const items = rawItems.map(mapUserResponse);

  return {
    items,
    total: payload.total ?? items.length,
    page: payload.page ?? filters?.page ?? 1,
    pageSize: payload.pageSize ?? filters?.pageSize ?? 10,
  };
}

async function fetchUser(id: string): Promise<AdminUser> {
  const res = await fetch(`${API_BASE}/${id}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Erro ao carregar usuário");
  }

  const payload = await res.json();
  return mapUserResponse(payload.user ?? payload);
}

async function createUser(data: CreateAdminUserInput): Promise<AdminUser> {
  const { isSuperAdmin, permissions } = mapRolesToPayload(data.roles ?? []);

  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: 'include',
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      status: mapStatusToDb(data.status),
      isSuperAdmin,
      permissions,
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Erro ao criar usuário");
  }

  const payload = await res.json();
  return mapUserResponse(payload.user ?? payload);
}

async function updateUser(id: string, data: UpdateAdminUserInput): Promise<AdminUser> {
  const { isSuperAdmin, permissions } = data.roles
    ? mapRolesToPayload(data.roles)
    : { isSuperAdmin: undefined, permissions: undefined };

  const res = await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: 'include',
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      status: data.status ? mapStatusToDb(data.status) : undefined,
      isSuperAdmin,
      permissions,
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Erro ao atualizar usuário");
  }

  const payload = await res.json();
  return mapUserResponse(payload.user ?? payload);
}

async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "DELETE",
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Erro ao excluir usuário");
  }
}

async function toggleUserStatus(id: string, status: "active" | "blocked"): Promise<AdminUser> {
  const res = await fetch(`${API_BASE}/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: 'include',
    body: JSON.stringify({ status: mapStatusToDb(status) }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Erro ao atualizar status");
  }

  const payload = await res.json();
  return mapUserResponse(payload.user ?? payload);
}

async function resetPassword(id: string): Promise<ResetPasswordResponse> {
  const res = await fetch(`${API_BASE}/${id}/reset`, {
    method: "POST",
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || "Erro ao resetar senha");
  }

  return res.json();
}

async function fetchRoles(): Promise<{ groups: RoleGroup[] }> {
  return { groups: ROLE_GROUPS };
}

// ====================
// HOOKS
// ====================

export function useUsers(filters?: AdminUserFilters) {
  const queryKey = filters
    ? adminUsersKeys.list(JSON.stringify(filters))
    : adminUsersKeys.lists();

  return useQuery({
    queryKey,
    queryFn: () => fetchUsers(filters),
    staleTime: 30_000,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: adminUsersKeys.detail(id),
    queryFn: () => fetchUser(id),
    enabled: Boolean(id),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUsersKeys.lists() });
      message.success("Usuário criado com sucesso");
    },
    onError: (error: Error) => {
      message.error(error.message || "Erro ao criar usuário");
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAdminUserInput }) =>
      updateUser(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: adminUsersKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: adminUsersKeys.detail(data.id),
      });
      message.success("Usuário atualizado com sucesso");
    },
    onError: (error: Error) => {
      message.error(error.message || "Erro ao atualizar usuário");
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUsersKeys.lists() });
      message.success("Usuário excluído com sucesso");
    },
    onError: (error: Error) => {
      message.error(error.message || "Erro ao excluir usuário");
    },
  });
}

export function useToggleUserStatus() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ToggleStatusInput["status"] }) =>
      toggleUserStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: adminUsersKeys.lists() });

      const previousData = queryClient.getQueriesData({
        queryKey: adminUsersKeys.lists(),
      });

      const nextStatus: AdminStatus = status;

      queryClient.setQueriesData<AdminUserListResponse>(
        { queryKey: adminUsersKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((user) =>
              user.id === id ? { ...user, status: nextStatus } : user
            ),
          };
        },
      );

      return { previousData };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      message.error(error.message || "Erro ao atualizar status");
    },
    onSuccess: (data) => {
      message.success(
        `Usuário ${data.status === "active" ? "ativado" : "bloqueado"} com sucesso`,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: adminUsersKeys.lists() });
    },
  });
}

export function useResetPassword() {
  const { message } = App.useApp();

  return useMutation({
    mutationFn: resetPassword,
    onSuccess: (data) => {
      message.success(data.message);
    },
    onError: (error: Error) => {
      message.error(error.message || "Erro ao resetar senha");
    },
  });
}

export function useRoles() {
  return useQuery({
    queryKey: adminUsersKeys.roles,
    queryFn: fetchRoles,
    staleTime: Infinity,
  });
}
