'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App, Flex, Space, Table, Tag } from 'antd';
import type { TableProps } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { DeleteOutlined, EyeOutlined, KeyOutlined, LockOutlined, MailOutlined, UnlockOutlined } from '@ant-design/icons';
import type { AccountStatus, AdminClient, ClientType } from '@/modules/admin/application/types';
import { blockAccounts, deleteAccount, resendVerificationEmail, resetPassword, unblockAccounts } from '@/modules/admin/application/api/clients';
import { ELButton, ELInput, ELPopconfirm, ELSelect } from '@/shared/ui';
import { formatCentsAsBRL } from '@/shared/utils/format';

interface ClientsTableProps {
  clients: AdminClient[];
  onViewClient: (client: AdminClient) => void;
  onStatusChange: (id: string, status: AccountStatus) => void;
  onDelete: (id: string) => void;
}

const statusColors: Record<AccountStatus, string> = {
  active: 'success',
  blocked: 'error',
  suspended: 'default',
};

const statusLabels: Record<AccountStatus, string> = {
  active: 'Ativo',
  blocked: 'Bloqueado',
  suspended: 'Suspenso',
};

export function ClientsTable({ clients, onViewClient, onStatusChange, onDelete }: ClientsTableProps) {
  const { message } = App.useApp();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchValue, setSearchValue] = useState('');
  const [q, setQ] = useState('');
  const [type, setType] = useState<ClientType | 'all'>('all');
  const [status, setStatus] = useState<AccountStatus | 'all'>('all');
  const [emailFilter, setEmailFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const normalizedQuery = useMemo(() => q.trim().toLowerCase(), [q]);
  const normalizedDigits = useMemo(() => q.replace(/\D/g, ''), [q]);

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesType = type === 'all' || client.type === type;
      const matchesStatus = status === 'all' || client.status === status;
      const matchesEmail =
        emailFilter === 'all' ||
        (emailFilter === 'verified' && client.emailVerified !== false) ||
        (emailFilter === 'unverified' && client.emailVerified === false);

      if (!normalizedQuery && !normalizedDigits) {
        return matchesType && matchesStatus && matchesEmail;
      }

      const nameMatch = client.name.toLowerCase().includes(normalizedQuery);
      const emailMatch = client.email.toLowerCase().includes(normalizedQuery);
      const documentMatch = client.document
        ? client.document.toLowerCase().includes(normalizedQuery) ||
          client.document.replace(/\D/g, '').includes(normalizedDigits)
        : false;

      return matchesType && matchesStatus && matchesEmail && (nameMatch || emailMatch || documentMatch);
    });
  }, [clients, emailFilter, normalizedDigits, normalizedQuery, status, type]);

  // Calcular página válida inline (corrige página se ficou maior que o máximo)
  const maxPage = Math.max(1, Math.ceil(filteredClients.length / pageSize) || 1);
  const validPage = Math.min(page, maxPage);

  const offset = (validPage - 1) * pageSize;
  const paginatedClients = useMemo(
    () => filteredClients.slice(offset, offset + pageSize),
    [filteredClients, offset, pageSize]
  );

  const blockMutation = useMutation({
    mutationFn: blockAccounts,
    onSuccess: (_data, ids) => {
      ids.forEach((id) => onStatusChange(id, 'blocked'));
      message.success('Contas bloqueadas com sucesso');
      setSelectedRowKeys([]);
    },
    onError: () => {
      message.error('Falha ao bloquear contas');
    },
  });

  const unblockMutation = useMutation({
    mutationFn: unblockAccounts,
    onSuccess: (_data, ids) => {
      ids.forEach((id) => onStatusChange(id, 'active'));
      message.success('Contas desbloqueadas com sucesso');
      setSelectedRowKeys([]);
    },
    onError: () => {
      message.error('Falha ao desbloquear contas');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: () => {
      message.success('Senha resetada com sucesso');
      setSelectedRowKeys([]);
    },
    onError: () => {
      message.error('Falha ao resetar senha');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: (_data, id) => {
      onDelete(id);
      message.success('Conta excluída com sucesso');
      setSelectedRowKeys([]);
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : 'Falha ao excluir conta';
      message.error(msg);
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: resendVerificationEmail,
    onSuccess: (data) => {
      if (data.emailSent) {
        message.success('Email de verificacao reenviado com sucesso');
      } else {
        message.warning('Nao foi possivel enviar o email. Tente novamente.');
      }
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : 'Falha ao reenviar email';
      message.error(msg);
    },
  });

  const handleBlock = (ids: string[]) => {
    blockMutation.mutate(ids);
  };

  const handleUnblock = (ids: string[]) => {
    unblockMutation.mutate(ids);
  };

  const handleResetPassword = (ids: string[]) => {
    resetPasswordMutation.mutate(ids);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const columns: TableProps<AdminClient>['columns'] = [
    {
      title: 'Tipo',
      dataIndex: 'type',
      width: 80,
      render: (v: ClientType) => <Tag color={v === 'PJ' ? 'blue' : 'green'}>{v}</Tag>,
    },
    {
      title: 'Nome',
      dataIndex: 'name',
      width: 220,
      ellipsis: true,
    },
    {
      title: 'E-mail',
      dataIndex: 'email',
      width: 260,
      render: (email: string, record) => (
        <Space size={4}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
          {record.emailVerified === false && <Tag color="red" style={{ marginInlineEnd: 0 }}>Nao verificado</Tag>}
        </Space>
      ),
    },
    {
      title: 'Saldo em carteira',
      dataIndex: 'walletBalance',
      width: 160,
      align: 'right',
      render: (v: number) => formatCentsAsBRL(v),
      sorter: (a, b) => a.walletBalance - b.walletBalance,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (v: AccountStatus) => <Tag color={statusColors[v]}>{statusLabels[v]}</Tag>,
    },
    {
      title: 'Ações',
      key: 'actions',
      fixed: 'right',
      width: 340,
      render: (_, record) => (
        <Space size="small">
          <ELButton
            variant="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/admin/contas/${record.id}`)}
          >
            Ver detalhes
          </ELButton>
          {record.emailVerified === false && (
            <ELPopconfirm
              title="Reenviar email de verificacao?"
              onConfirm={() => resendVerificationMutation.mutate(record.id)}
              okText="Sim"
              cancelText="Nao"
            >
              <ELButton
                variant="link"
                size="small"
                icon={<MailOutlined />}
                disabled={resendVerificationMutation.isPending}
              >
                Reenviar email
              </ELButton>
            </ELPopconfirm>
          )}
          {record.status === 'blocked' ? (
            <ELPopconfirm
              title="Desbloquear conta?"
              onConfirm={() => handleUnblock([record.id])}
              okText="Sim"
              cancelText="Não"
            >
              <ELButton
                variant="link"
                size="small"
                icon={<UnlockOutlined />}
                disabled={unblockMutation.isPending || blockMutation.isPending || deleteMutation.isPending}
              >
                Desbloquear
              </ELButton>
            </ELPopconfirm>
          ) : (
            record.status === 'active' && (
              <ELPopconfirm
                title="Bloquear conta?"
                onConfirm={() => handleBlock([record.id])}
                okText="Sim"
                cancelText="Não"
              >
                <ELButton
                  variant="link"
                  size="small"
                  danger
                  icon={<LockOutlined />}
                  disabled={blockMutation.isPending || unblockMutation.isPending || deleteMutation.isPending}
                >
                  Bloquear
                </ELButton>
              </ELPopconfirm>
            )
          )}
          <ELPopconfirm
            title="Deseja realmente excluir o usuário?"
            description="Esta ação não pode ser desfeita."
            onConfirm={() => handleDelete(record.id)}
            okText="Sim, excluir"
            cancelText="Cancelar"
            variant="danger"
          >
            <ELButton
              variant="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={deleteMutation.isPending || blockMutation.isPending || unblockMutation.isPending}
            >
              Excluir
            </ELButton>
          </ELPopconfirm>
        </Space>
      ),
    },
  ];

  const rowSelection: TableProps<AdminClient>['rowSelection'] = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  };

  const selectedIds = selectedRowKeys as string[];
  const hasSelection = selectedIds.length > 0;

  return (
    <Flex vertical gap={12}>
      <Flex wrap="wrap" gap={8} align="center">
        <ELInput.Search
          value={searchValue}
          onChange={(event) => {
            const value = event.target.value;
            setSearchValue(value);
            if (!value) {
              setQ('');
              setPage(1);
            }
          }}
          allowClear
          placeholder="Buscar por nome, e-mail ou documento..."
          onSearch={(v) => {
            setPage(1);
            setQ(v);
            setSearchValue(v);
          }}
        />
        <ELSelect
          value={type}
          onChange={(v) => {
            setPage(1);
            setType(v);
          }}
          style={{ width: 120 }}
          options={[
            { label: 'Todos tipos', value: 'all' },
            { label: 'PF', value: 'PF' },
            { label: 'PJ', value: 'PJ' },
          ]}
        />
        <ELSelect
          value={status}
          onChange={(v) => {
            setPage(1);
            setStatus(v);
          }}
          style={{ width: 160 }}
          options={[
            { label: 'Todos status', value: 'all' },
            { label: 'Ativo', value: 'active' },
            { label: 'Bloqueado', value: 'blocked' },
            { label: 'Suspenso', value: 'suspended' },
          ]}
        />
        <ELSelect
          value={emailFilter}
          onChange={(v) => {
            setPage(1);
            setEmailFilter(v);
          }}
          style={{ width: 180 }}
          options={[
            { label: 'Todos emails', value: 'all' },
            { label: 'Verificado', value: 'verified' },
            { label: 'Nao verificado', value: 'unverified' },
          ]}
        />
      </Flex>

      {hasSelection && (
        <Flex gap={8} wrap="wrap">
          <ELPopconfirm
            title={`Bloquear ${selectedIds.length} conta(s)?`}
            onConfirm={() => handleBlock(selectedIds)}
            okText="Sim"
            cancelText="Não"
          >
            <ELButton danger icon={<LockOutlined />}>
              Bloquear ({selectedIds.length})
            </ELButton>
          </ELPopconfirm>
          <ELPopconfirm
            title={`Desbloquear ${selectedIds.length} conta(s)?`}
            onConfirm={() => handleUnblock(selectedIds)}
            okText="Sim"
            cancelText="Não"
          >
            <ELButton icon={<UnlockOutlined />}>
              Desbloquear ({selectedIds.length})
            </ELButton>
          </ELPopconfirm>
          <ELPopconfirm
            title={`Resetar senha de ${selectedIds.length} conta(s)?`}
            onConfirm={() => handleResetPassword(selectedIds)}
            okText="Sim"
            cancelText="Não"
          >
            <ELButton icon={<KeyOutlined />}>
              Resetar Senha ({selectedIds.length})
            </ELButton>
          </ELPopconfirm>
        </Flex>
      )}

      <Table<AdminClient>
        rowKey="id"
        dataSource={paginatedClients}
        columns={columns}
        loading={blockMutation.isPending || unblockMutation.isPending || deleteMutation.isPending || resendVerificationMutation.isPending}
        rowSelection={rowSelection}
        scroll={{ x: 980, y: 'calc(100vh - 400px)' }}
        pagination={{
          current: validPage,
          pageSize,
          total: filteredClients.length,
          showSizeChanger: true,
          showTotal: (total) => `Total: ${total} clientes`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />
    </Flex>
  );
}
