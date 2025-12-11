'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  Flex,
  Select,
  Button,
  Tag,
  Space,
  Popconfirm,
  App,
} from 'antd';
import { ELInput } from '@/components/ui/ELInput';
import type { ColumnsType } from 'antd/es/table';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { CheckOutlined, DollarOutlined } from '@ant-design/icons';
import type { CommissionItem, CommissionStatus, PeriodFilter, Paged } from '@/lib/admin/finance/types';
import { listCommissions, approveCommission, markCommissionPaid } from '@/lib/admin/finance/api';

interface CommissionsTableProps {
  period: PeriodFilter;
}

const statusColors: Record<CommissionStatus, string> = {
  calculated: 'default',
  approved: 'processing',
  paid: 'success',
};

const statusLabels: Record<CommissionStatus, string> = {
  calculated: 'Calculado',
  approved: 'Aprovado',
  paid: 'Pago',
};

export function CommissionsTable({ period }: CommissionsTableProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<CommissionStatus | 'all'>('all');

  const params = useMemo(
    () => ({
      page,
      pageSize,
      q,
      status: status === 'all' ? undefined : status,
      ...period,
    }),
    [page, pageSize, q, status, period]
  );

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'finance', 'commissions', params],
    queryFn: () => listCommissions(params),
    placeholderData: keepPreviousData,
  });

  const approveMutation = useMutation({
    mutationFn: approveCommission,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'finance', 'commissions'] });
      queryClient.setQueriesData({ queryKey: ['admin', 'finance', 'commissions'] }, (old: Paged<CommissionItem> | undefined) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((c: CommissionItem) =>
            c.id === id ? { ...c, status: 'approved' as CommissionStatus } : c
          ),
        };
      });
    },
    onSuccess: () => {
      message.success('Comissão aprovada');
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'commissions'] });
    },
    onError: () => {
      message.error('Falha ao aprovar comissão');
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'commissions'] });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: markCommissionPaid,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'finance', 'commissions'] });
      queryClient.setQueriesData({ queryKey: ['admin', 'finance', 'commissions'] }, (old: Paged<CommissionItem> | undefined) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((c: CommissionItem) =>
            c.id === id ? { ...c, status: 'paid' as CommissionStatus } : c
          ),
        };
      });
    },
    onSuccess: () => {
      message.success('Comissão marcada como paga');
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'commissions'] });
    },
    onError: () => {
      message.error('Falha ao marcar comissão como paga');
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'commissions'] });
    },
  });

  const handleApprove = (id: string) => {
    approveMutation.mutate(id);
  };

  const handleMarkPaid = (id: string) => {
    markPaidMutation.mutate(id);
  };

  const columns: ColumnsType<CommissionItem> = [
    {
      title: 'Período',
      key: 'period',
      width: 200,
      render: (_, record) =>
        `${dayjs(record.periodStart).format('DD/MM/YYYY')} - ${dayjs(record.periodEnd).format('DD/MM/YYYY')}`,
    },
    {
      title: 'Tipo',
      dataIndex: 'agentType',
      width: 100,
      render: (v: 'channel' | 'sales') => (
        <Tag color={v === 'channel' ? 'blue' : 'green'}>
          {v === 'channel' ? 'Canal' : 'Vendas'}
        </Tag>
      ),
    },
    {
      title: 'Agente',
      dataIndex: 'agentName',
      width: 220,
      ellipsis: true,
    },
    {
      title: 'Valor',
      dataIndex: 'amount',
      width: 130,
      align: 'right',
      render: (v: number) =>
        v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      sorter: (a, b) => a.amount - b.amount,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (v: CommissionStatus) => <Tag color={statusColors[v]}>{statusLabels[v]}</Tag>,
    },
    {
      title: 'Ações',
      key: 'actions',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          {record.status === 'calculated' && (
            <Popconfirm
              title="Aprovar comissão?"
              onConfirm={() => handleApprove(record.id)}
              okText="Sim"
              cancelText="Não"
            >
              <Button type="link" size="small" icon={<CheckOutlined />}>
                Aprovar
              </Button>
            </Popconfirm>
          )}
          {record.status === 'approved' && (
            <Popconfirm
              title="Marcar como pago?"
              onConfirm={() => handleMarkPaid(record.id)}
              okText="Sim"
              cancelText="Não"
            >
              <Button type="link" size="small" icon={<DollarOutlined />}>
                Marcar Pago
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex gap={8} wrap="wrap">
        <ELInput.Search
          placeholder="Buscar agente..."
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
        <Select
          value={status}
          onChange={(v) => {
            setPage(1);
            setStatus(v);
          }}
          style={{ width: 150 }}
          options={[
            { label: 'Todos', value: 'all' },
            { label: 'Calculado', value: 'calculated' },
            { label: 'Aprovado', value: 'approved' },
            { label: 'Pago', value: 'paid' },
          ]}
        />
      </Flex>

      <Table<CommissionItem>
        rowKey="id"
        dataSource={data?.items ?? []}
        columns={columns}
        loading={isLoading}
        pagination={{
          current: page,
          pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (total) => `Total: ${total}`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
        scroll={{ x: 1100, y: 'calc(100vh - 480px)' }}
      />
    </Flex>
  );
}
