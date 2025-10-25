'use client';

import { useState, useMemo } from 'react';
import { Table, Tag, Space, Button, Input, Select, Flex, App, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/lib/table/interface';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  LockOutlined,
  UnlockOutlined,
  EyeOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import type { AdminClient, ClientType, AccountStatus, ClientsResponse } from '@/lib/admin/types';
import {
  fetchClients,
  blockAccounts,
  unblockAccounts,
  resetPassword,
} from '@/lib/admin/api/clients';

interface ClientsTableProps {
  onViewClient: (client: AdminClient) => void;
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

export function ClientsTable({ onViewClient }: ClientsTableProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [type, setType] = useState<ClientType | 'all'>('all');
  const [status, setStatus] = useState<AccountStatus | 'all'>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const params = useMemo(
    () => ({ page, pageSize, q, type, status }),
    [page, pageSize, q, type, status]
  );

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'clients', params],
    queryFn: () => fetchClients(params),
    placeholderData: keepPreviousData,
  });

  // Mutations
  const blockMutation = useMutation({
    mutationFn: blockAccounts,
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'clients'] });
      queryClient.setQueriesData({ queryKey: ['admin', 'clients'] }, (old: ClientsResponse | undefined) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((c: AdminClient) =>
            ids.includes(c.id) ? { ...c, status: 'blocked' as AccountStatus } : c
          ),
        };
      });
    },
    onSuccess: () => {
      message.success('Contas bloqueadas com sucesso');
      setSelectedRowKeys([]);
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
    },
    onError: () => {
      message.error('Falha ao bloquear contas');
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: unblockAccounts,
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'clients'] });
      queryClient.setQueriesData({ queryKey: ['admin', 'clients'] }, (old: ClientsResponse | undefined) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((c: AdminClient) =>
            ids.includes(c.id) ? { ...c, status: 'active' as AccountStatus } : c
          ),
        };
      });
    },
    onSuccess: () => {
      message.success('Contas desbloqueadas com sucesso');
      setSelectedRowKeys([]);
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
    },
    onError: () => {
      message.error('Falha ao desbloquear contas');
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
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
      title: 'Documento',
      dataIndex: 'document',
      width: 160,
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
      width: 140,
      align: 'right',
      render: (v: number) =>
        v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
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
      width: 140,
      align: 'right',
      render: (v: number) =>
        v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      sorter: (a, b) => a.creditsMonth - b.creditsMonth,
    },
    {
      title: 'Débitos no mês',
      dataIndex: 'debitsMonth',
      width: 140,
      align: 'right',
      render: (v: number) =>
        v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      sorter: (a, b) => a.debitsMonth - b.debitsMonth,
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
              <Button type="link" size="small" icon={<UnlockOutlined />}>
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
                <Button type="link" size="small" danger icon={<LockOutlined />}>
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
          allowClear
          placeholder="Buscar por nome, e-mail ou documento..."
          onSearch={(v) => {
            setPage(1);
            setQ(v);
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
        dataSource={data?.items ?? []}
        columns={columns}
        loading={isLoading}
        rowSelection={rowSelection}
        scroll={{ x: 1600 }}
        pagination={{
          current: data?.page ?? page,
          pageSize: data?.pageSize ?? pageSize,
          total: data?.total ?? 0,
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
