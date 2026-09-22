"use client";

import { Tag, Tooltip, Flex, Typography, App } from "antd";
import { EditOutlined, DeleteOutlined, LockOutlined } from "@ant-design/icons";
import { ELButton, ELSwitch } from '@/shared/ui';
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable';
import type { AdminUser } from "@/modules/auth/application/types";
import {
  useToggleUserStatus,
  useDeleteUser,
  useResetPassword,
} from "@/modules/auth/application/hooks";
import { getPermissionLabel } from "@/modules/auth/application/roles";
import { ADMIN_PERMISSION_KEYS, type AdminPermissionKey } from "@/modules/auth/application/types";
import { formatDateTimeBR } from '@/shared/utils/date';

interface UsersTableProps {
  data: AdminUser[];
  loading?: boolean;
  onEdit: (user: AdminUser) => void;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
}

export function UsersTable({
  data,
  loading,
  onEdit,
  pagination,
}: UsersTableProps) {
  const { modal } = App.useApp();
  const toggleStatusMutation = useToggleUserStatus();
  const deleteMutation = useDeleteUser();
  const resetPasswordMutation = useResetPassword();

  const allPermissions = ADMIN_PERMISSION_KEYS;

  const handleStatusToggle = (user: AdminUser, checked: boolean) => {
    const newStatus = checked ? "active" : "blocked";

    modal.confirm({
      title: `${checked ? "Ativar" : "Bloquear"} usuário`,
      content: `Tem certeza que deseja ${checked ? "ativar" : "bloquear"} ${user.name}?`,
      okText: "Sim",
      cancelText: "Cancelar",
      onOk: () => {
        toggleStatusMutation.mutate({ id: user.id, status: newStatus });
      },
    });
  };

  const handleDelete = (user: AdminUser) => {
    modal.confirm({
      title: "Excluir usuário",
      content: `Tem certeza que deseja excluir ${user.name}? Esta ação não pode ser desfeita.`,
      okText: "Excluir",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: () => {
        deleteMutation.mutate(user.id);
      },
    });
  };

  const handleResetPassword = (user: AdminUser) => {
    modal.confirm({
      title: "Resetar senha",
      content: `Enviar instruções de redefinição de senha para ${user.email}?`,
      okText: "Enviar",
      cancelText: "Cancelar",
      onOk: () => {
        resetPasswordMutation.mutate(user.id);
      },
    });
  };

  const columns: DataTableColumn<AdminUser>[] = [
    {
      title: "Nome",
      dataIndex: "name",
      key: "name",
      sorter: (a: AdminUser, b: AdminUser) => a.name.localeCompare(b.name),
      render: (name: unknown, user: AdminUser) => (
        <Flex vertical gap={4}>
          <Typography.Text strong>{String(name)}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {user.email}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: unknown, user: AdminUser) => (
        <Flex align="center" gap={8}>
          <Tag color={status === "active" ? "success" : "error"}>
            {status === "active" ? "Ativo" : "Bloqueado"}
          </Tag>
          <ELSwitch
            size="small"
            checked={status === "active"}
            onChange={(checked) => handleStatusToggle(user, checked)}
            loading={toggleStatusMutation.isPending}
          />
        </Flex>
      ),
    },
    {
      title: "Permissões",
      dataIndex: "permissions",
      key: "permissions",
      render: (_: unknown, user: AdminUser) => {
        const permissionList: string[] = user.isSuperAdmin
          ? ["admin.super", ...allPermissions]
          : user.permissions;

        const displayRoles = permissionList.slice(0, 2);
        const remainingCount = Math.max(permissionList.length - displayRoles.length, 0);

        const renderLabel = (key: string) => {
          if (key === "admin.super") {
            return "Super Administrador";
          }
          return getPermissionLabel(key as AdminPermissionKey);
        };

        const remainingItems = permissionList.slice(2);

        return (
          <Flex gap={4} wrap="wrap">
            {displayRoles.map((roleKey) => (
              <Tag key={roleKey} color={roleKey === "admin.super" ? "gold" : "blue"}>
                {renderLabel(roleKey)}
              </Tag>
            ))}
            {remainingCount > 0 && (
              <Tooltip
                title={
                  <Flex vertical gap={4}>
                    {remainingItems.map((roleKey) => (
                      <div key={roleKey}>{renderLabel(roleKey)}</div>
                    ))}
                  </Flex>
                }
              >
                <Tag>+{remainingCount}</Tag>
              </Tooltip>
            )}
          </Flex>
        );
      },
    },
    {
      title: "Último Acesso",
      dataIndex: "lastAccessAt",
      key: "lastAccessAt",
      width: 150,
      sorter: (a: AdminUser, b: AdminUser) => {
        if (!a.lastAccessAt) return 1;
        if (!b.lastAccessAt) return -1;
        return (
          new Date(a.lastAccessAt).getTime() -
          new Date(b.lastAccessAt).getTime()
        );
      },
      render: (lastAccessAt: unknown) => {
        if (!lastAccessAt)
          return <Typography.Text type="secondary">Nunca</Typography.Text>;
        return <Typography.Text>{formatDateTimeBR(lastAccessAt as string)}</Typography.Text>;
      },
    },
    {
      title: "Atualizado em",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 150,
      sorter: (a: AdminUser, b: AdminUser) =>
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
      render: (updatedAt: unknown) => (
        <Typography.Text>{formatDateTimeBR(updatedAt as string)}</Typography.Text>
      ),
    },
    {
      title: "Ações",
      key: "actions",
      width: 150,
      fixed: "right",
      isActions: true,
      render: (_: unknown, user: AdminUser) => (
        <Flex gap={8}>
          <Tooltip title="Editar">
            <ELButton
              variant="text"
              icon={<EditOutlined />}
              onClick={() => onEdit(user)}
            />
          </Tooltip>
          <Tooltip title="Resetar senha">
            <ELButton
              variant="text"
              icon={<LockOutlined />}
              onClick={() => handleResetPassword(user)}
              loading={resetPasswordMutation.isPending}
            />
          </Tooltip>
          <Tooltip title="Excluir">
            <ELButton
              variant="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(user)}
              loading={deleteMutation.isPending}
              disabled={user.id === "master-001"}
            />
          </Tooltip>
        </Flex>
      ),
    },
  ];

  return (
    <DataTable<AdminUser>
      columns={columns}
      data={data}
      rowKey="id"
      loading={loading}
      enableMobileCards={true}
      pagination={
        pagination
          ? {
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              onChange: pagination.onChange,
              showSizeChanger: true,
              showTotal: (total) => `Total: ${total} usuários`,
            }
          : false
      }
      scrollX={1200}
      scrollY="calc(100vh - 340px)"
    />
  );
}
