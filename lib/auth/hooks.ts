/**
 * React Query hooks para gestão de usuários admin
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App } from "antd";
import { adminUsersKeys } from "./queryKeys";
import type {
  AdminUser,
  AdminUserFilters,
  AdminUserListResponse,
  CreateAdminUserInput,
  UpdateAdminUserInput,
  ToggleStatusInput,
  ResetPasswordResponse,
} from "./types";
import type { RoleGroup } from "./roles";

/**
 * Fetch users list with filters
 */
async function fetchUsers(
  filters?: AdminUserFilters
): Promise<AdminUserListResponse> {
  const params = new URLSearchParams();

  if (filters?.q) params.set("q", filters.q);
  if (filters?.status && filters.status !== "all")
    params.set("status", filters.status);
  if (filters?.role) params.set("role", filters.role);
  if (filters?.page) params.set("page", filters.page.toString());
  if (filters?.pageSize) params.set("pageSize", filters.pageSize.toString());
  if (filters?.sort) params.set("sort", filters.sort);

  const res = await fetch(`/api/mock/admin/users?${params.toString()}`);
  if (!res.ok) throw new Error("Erro ao carregar usuários");
  return res.json();
}

/**
 * Fetch single user
 */
async function fetchUser(id: string): Promise<AdminUser> {
  const res = await fetch(`/api/mock/admin/users/${id}`);
  if (!res.ok) throw new Error("Erro ao carregar usuário");
  return res.json();
}

/**
 * Create user
 */
async function createUser(data: CreateAdminUserInput): Promise<AdminUser> {
  const res = await fetch("/api/mock/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erro ao criar usuário");
  }

  return res.json();
}

/**
 * Update user
 */
async function updateUser(
  id: string,
  data: UpdateAdminUserInput
): Promise<AdminUser> {
  const res = await fetch(`/api/mock/admin/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erro ao atualizar usuário");
  }

  return res.json();
}

/**
 * Delete user
 */
async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`/api/mock/admin/users/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erro ao excluir usuário");
  }
}

/**
 * Toggle user status
 */
async function toggleUserStatus(
  id: string,
  status: "active" | "blocked"
): Promise<AdminUser> {
  const res = await fetch(`/api/mock/admin/users/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erro ao atualizar status");
  }

  return res.json();
}

/**
 * Reset user password
 */
async function resetPassword(id: string): Promise<ResetPasswordResponse> {
  const res = await fetch(`/api/mock/admin/users/${id}/reset`, {
    method: "POST",
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erro ao resetar senha");
  }

  return res.json();
}

/**
 * Fetch roles catalog
 */
async function fetchRoles(): Promise<{ groups: RoleGroup[] }> {
  const res = await fetch("/api/mock/admin/roles");
  if (!res.ok) throw new Error("Erro ao carregar permissões");
  return res.json();
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
    staleTime: 30_000, // 30 seconds
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: adminUsersKeys.detail(id),
    queryFn: () => fetchUser(id),
    enabled: !!id,
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
    mutationFn: ({ id, status }: { id: string; status: "active" | "blocked" }) =>
      toggleUserStatus(id, status),
    onMutate: async ({ id, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: adminUsersKeys.lists() });

      // Snapshot previous value
      const previousData = queryClient.getQueriesData({
        queryKey: adminUsersKeys.lists(),
      });

      // Optimistically update
      queryClient.setQueriesData<AdminUserListResponse>(
        { queryKey: adminUsersKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((user) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              user.id === id ? { ...user, status: status as any } : user
            ),
          };
        }
      );

      return { previousData };
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      message.error(error.message || "Erro ao atualizar status");
    },
    onSuccess: (data) => {
      message.success(
        `Usuário ${data.status === "active" ? "ativado" : "bloqueado"} com sucesso`
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
    staleTime: Infinity, // Roles don't change often
  });
}
