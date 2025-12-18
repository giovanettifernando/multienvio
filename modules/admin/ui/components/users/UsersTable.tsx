"use client";

import { Table, Tag, Switch, Tooltip, Button, Flex, Typography, App } from "antd";
import { EditOutlined, DeleteOutlined, KeyOutlined } from "@ant-design/icons";
import type { TableProps } from 'antd';
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

  const columns: TableProps<AdminUser>['columns'] = [
    {
      title: "Nome",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string, user) => (
        <Flex vertical gap={4}>
          <Typography.Text strong>{name}</Typography.Text>
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
      filters: [
        { text: "Ativo", value: "active" },
        { text: "Bloqueado", value: "blocked" },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: string, user) => (
        <Flex align="center" gap={8}>
          <Tag color={status === "active" ? "success" : "error"}>
            {status === "active" ? "Ativo" : "Bloqueado"}
          </Tag>
          <Switch
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
      render: (_: AdminPermissionKey[], user) => {
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
      sorter: (a, b) => {
        if (!a.lastAccessAt) return 1;
        if (!b.lastAccessAt) return -1;
        return (
          new Date(a.lastAccessAt).getTime() -
          new Date(b.lastAccessAt).getTime()
        );
      },
      render: (lastAccessAt: string | null) => {
        if (!lastAccessAt)
          return <Typography.Text type="secondary">Nunca</Typography.Text>;
        return <Typography.Text>{formatDateTimeBR(lastAccessAt)}</Typography.Text>;
      },
    },
    {
      title: "Atualizado em",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 150,
      sorter: (a, b) =>
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
      render: (updatedAt: string) => (
        <Typography.Text>{formatDateTimeBR(updatedAt)}</Typography.Text>
      ),
    },
    {
      title: "Ações",
      key: "actions",
      width: 150,
      fixed: "right",
      render: (_, user) => (
        <Flex gap={8}>
          <Tooltip title="Editar">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => onEdit(user)}
            />
          </Tooltip>
          <Tooltip title="Resetar senha">
            <Button
              type="text"
              icon={<KeyOutlined />}
              onClick={() => handleResetPassword(user)}
              loading={resetPasswordMutation.isPending}
            />
          </Tooltip>
          <Tooltip title="Excluir">
            <Button
              type="text"
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
    <Table
      columns={columns}
      dataSource={data}
      rowKey="id"
      loading={loading}
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
      scroll={{ x: 1200, y: 'calc(100vh - 340px)' }}
    />
  );
}
