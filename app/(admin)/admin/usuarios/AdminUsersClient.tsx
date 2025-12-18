"use client";

import { useState } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { PageShell } from '@/shared/ui/PageShell';
import { SearchFilters } from '@/shared/ui/SearchFilters';
import { UsersTable } from '@/modules/admin/ui/components/users/UsersTable';
import { UserDrawer } from '@/modules/admin/ui/components/users/UserDrawer';
import { useUsers, useRoles } from "@/modules/auth/application/hooks";
import {
  ADMIN_PERMISSION_KEYS,
  type AdminPermissionKey,
  type AdminUser,
  type AdminUserFilters,
} from "@/modules/auth/application/types";

export default function AdminUsersClient() {
  const [filters, setFilters] = useState<AdminUserFilters>({
    q: "",
    status: "all",
    permission: undefined,
    page: 1,
    pageSize: 10,
    sort: "updated_desc",
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const { data, isLoading } = useUsers(filters);
  const { data: rolesData } = useRoles();

  const handleSearch = (q: string) => {
    setFilters((prev) => ({ ...prev, q, page: 1 }));
  };

  const handleStatusFilter = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      status: status as "all" | "active" | "blocked",
      page: 1,
    }));
  };

  const permissionSet = new Set<AdminPermissionKey>(ADMIN_PERMISSION_KEYS);

  const handlePermissionFilter = (permission: string) => {
    const normalized = permissionSet.has(permission as AdminPermissionKey)
      ? (permission as AdminPermissionKey)
      : undefined;
    setFilters((prev) => ({
      ...prev,
      permission: normalized,
      page: 1,
    }));
  };

  const handleReset = () => {
    setFilters({
      q: "",
      status: "all",
      permission: undefined,
      page: 1,
      pageSize: 10,
      sort: "updated_desc",
    });
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setFilters((prev) => ({ ...prev, page, pageSize }));
  };

  const handleAddUser = () => {
    setSelectedUser(null);
    setDrawerOpen(true);
  };

  const handleEditUser = (user: AdminUser) => {
    setSelectedUser(user);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedUser(null);
  };

  const permissionOptions =
    rolesData?.groups.flatMap((group) =>
      group.roles
        .filter((role) => role.key !== "admin.super")
        .map((role) => ({
          label: role.label,
          value: role.key,
        })),
    ) || [];

  return (
    <PageShell
      title="Usuários Administrativos"
      gap="md"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddUser}>
          Adicionar Usuário
        </Button>
      }
    >
      <SearchFilters
        searchValue={filters.q}
        onSearchChange={handleSearch}
        searchPlaceholder="Buscar por nome ou e-mail..."
        filters={[
          {
            value: filters.status || "all",
            onChange: handleStatusFilter,
            options: [
              { label: "Todos os Status", value: "all" },
              { label: "Ativo", value: "active" },
              { label: "Bloqueado", value: "blocked" },
            ],
            placeholder: "Status",
          },
          {
            value: filters.permission || "",
            onChange: handlePermissionFilter,
            options: [
              { label: "Todas as Permissões", value: "" },
              ...permissionOptions,
            ],
            placeholder: "Permissão",
          },
        ]}
        onReset={handleReset}
      />

      <UsersTable
        data={data?.items || []}
        loading={isLoading}
        onEdit={handleEditUser}
        pagination={{
          current: data?.page || 1,
          pageSize: data?.pageSize || 10,
          total: data?.total || 0,
          onChange: handlePageChange,
        }}
      />

      <UserDrawer
        open={drawerOpen}
        user={selectedUser}
        onClose={handleCloseDrawer}
      />
    </PageShell>
  );
}
