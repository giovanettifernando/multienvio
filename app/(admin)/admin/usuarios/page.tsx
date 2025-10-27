"use client";

import { useState } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { PageShell } from "@/components/shared/PageShell";
import { SearchFilters } from "@/components/shared/SearchFilters";
import { UsersTable } from "@/components/admin/users/UsersTable";
import { UserDrawer } from "@/components/admin/users/UserDrawer";
import { useUsers, useRoles } from "@/lib/auth/hooks";
import type { AdminUser, AdminUserFilters } from "@/lib/auth/types";

export default function AdminUsersPage() {
  const [filters, setFilters] = useState<AdminUserFilters>({
    q: "",
    status: "all",
    role: undefined,
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

  const handleRoleFilter = (role: string) => {
    setFilters((prev) => ({
      ...prev,
      role: role || undefined,
      page: 1,
    }));
  };

  const handleReset = () => {
    setFilters({
      q: "",
      status: "all",
      role: undefined,
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

  const roleOptions = rolesData?.groups.flatMap((group) =>
    group.roles.map((role) => ({
      label: role.label,
      value: role.key,
    }))
  ) || [];

  return (
    <PageShell
      title="Usuários Administrativos"
      description="Gerencie usuários e permissões do painel administrativo"
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
            value: filters.role || "",
            onChange: handleRoleFilter,
            options: [
              { label: "Todas as Permissões", value: "" },
              ...roleOptions,
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
