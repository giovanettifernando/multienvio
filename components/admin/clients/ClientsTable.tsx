'use client';

import { useEffect, useMemo, useState } from 'react';
import { App, Button, Flex, Input, Popconfirm, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/lib/table/interface';
import { useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { EyeOutlined, KeyOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import type { AccountStatus, AdminClient, ClientType } from '@/lib/admin/types';
import { blockAccounts, resetPassword, unblockAccounts } from '@/lib/admin/api/clients';

interface ClientsTableProps {
  clients: AdminClient[];
  onViewClient: (client: AdminClient) => void;
  onStatusChange: (id: string, status: AccountStatus) => void;
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

function formatCurrencyFromCents(value: number): string {
  return (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ClientsTable({ clients, onViewClient, onStatusChange }: ClientsTableProps) {
  const { message } = App.useApp();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchValue, setSearchValue] = useState('');
  const [q, setQ] = useState('');
  const [type, setType] = useState<ClientType | 'all'>('all');
  const [status, setStatus] = useState<AccountStatus | 'all'>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const normalizedQuery = useMemo(() => q.trim().toLowerCase(), [q]);
  const normalizedDigits = useMemo(() => q.replace(/\D/g, ''), [q]);

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesType = type === 'all' || client.type === type;
      const matchesStatus = status === 'all' || client.status === status;

      if (!normalizedQuery && !normalizedDigits) {
        return matchesType && matchesStatus;
      }

      const nameMatch = client.name.toLowerCase().includes(normalizedQuery);
      const emailMatch = client.email.toLowerCase().includes(normalizedQuery);
      const documentMatch = client.document
        ? client.document.toLowerCase().includes(normalizedQuery) ||
          client.document.replace(/\D/g, '').includes(normalizedDigits)
        : false;

      return matchesType && matchesStatus && (nameMatch || emailMatch || documentMatch);
    });
  }, [clients, normalizedDigits, normalizedQuery, status, type]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredClients.length / pageSize) || 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [filteredClients.length, page, pageSize]);

  const offset = (page - 1) * pageSize;
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

  const handleBlock = (ids: string[]) => {
    blockMutation.mutate(ids);
  };

  const handleUnblock = (ids: string[]) => {
    unblockMutation.mutate(ids);
  };

  const handleResetPassword = (ids: string[]) => {
    resetPasswordMutation.mutate(ids);
  };

  const columns: ColumnsType<AdminClient> = [
    {
      title: 'Criada em',
      dataIndex: 'createdAt',
      width: 120,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
      sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
    },
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
      width: 220,
      ellipsis: true,
    },
    {
      title: 'Saldo em carteira',
      dataIndex: 'walletBalance',
      width: 160,
      align: 'right',
      render: (v: number) => formatCurrencyFromCents(v),
      sorter: (a, b) => a.walletBalance - b.walletBalance,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (v: AccountStatus) => <Tag color={statusColors[v]}>{statusLabels[v]}</Tag>,
    },
    {
      title: 'Créditos no mês',
      dataIndex: 'creditsMonth',
      width: 160,
      align: 'right',
      render: (v: number) => formatCurrencyFromCents(v),
      sorter: (a, b) => a.creditsMonth - b.creditsMonth,
    },
    {
      title: 'Débitos no mês',
      dataIndex: 'debitsMonth',
      width: 140,
      align: 'right',
      render: () => '—',
    },
    {
      title: 'Ações',
      key: 'actions',
      fixed: 'right',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => onViewClient(record)}>
            Ver
          </Button>
          {record.status === 'blocked' ? (
            <Popconfirm
              title="Desbloquear conta?"
              onConfirm={() => handleUnblock([record.id])}
              okText="Sim"
              cancelText="Não"
            >
              <Button
                type="link"
                size="small"
                icon={<UnlockOutlined />}
                disabled={unblockMutation.isPending || blockMutation.isPending}
              >
                Desbloquear
              </Button>
            </Popconfirm>
          ) : (
            record.status === 'active' && (
              <Popconfirm
                title="Bloquear conta?"
                onConfirm={() => handleBlock([record.id])}
                okText="Sim"
                cancelText="Não"
              >
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<LockOutlined />}
                  disabled={blockMutation.isPending || unblockMutation.isPending}
                >
                  Bloquear
                </Button>
              </Popconfirm>
            )
          )}
        </Space>
      ),
    },
  ];

  const rowSelection: TableRowSelection<AdminClient> = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  };

  const selectedIds = selectedRowKeys as string[];
  const hasSelection = selectedIds.length > 0;

  return (
    <Flex vertical gap={12}>
      <Flex wrap="wrap" gap={8} align="center">
        <Input.Search
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
          style={{ maxWidth: 360 }}
        />
        <Select
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
        <Select
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
      </Flex>

      {hasSelection && (
        <Flex gap={8} wrap="wrap">
          <Popconfirm
            title={`Bloquear ${selectedIds.length} conta(s)?`}
            onConfirm={() => handleBlock(selectedIds)}
            okText="Sim"
            cancelText="Não"
          >
            <Button danger icon={<LockOutlined />}>
              Bloquear ({selectedIds.length})
            </Button>
          </Popconfirm>
          <Popconfirm
            title={`Desbloquear ${selectedIds.length} conta(s)?`}
            onConfirm={() => handleUnblock(selectedIds)}
            okText="Sim"
            cancelText="Não"
          >
            <Button icon={<UnlockOutlined />}>
              Desbloquear ({selectedIds.length})
            </Button>
          </Popconfirm>
          <Popconfirm
            title={`Resetar senha de ${selectedIds.length} conta(s)?`}
            onConfirm={() => handleResetPassword(selectedIds)}
            okText="Sim"
            cancelText="Não"
          >
            <Button icon={<KeyOutlined />}>
              Resetar Senha ({selectedIds.length})
            </Button>
          </Popconfirm>
        </Flex>
      )}

      <Table<AdminClient>
        rowKey="id"
        dataSource={paginatedClients}
        columns={columns}
        loading={blockMutation.isPending || unblockMutation.isPending}
        rowSelection={rowSelection}
        scroll={{ x: 1400 }}
        pagination={{
          current: page,
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
