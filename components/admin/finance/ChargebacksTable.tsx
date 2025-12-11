'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  Flex,
  Input,
  Select,
  Button,
  Tag,
  Space,
  Popconfirm,
  App,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { ChargebackItem, ChargebackStatus, PaymentMethod, PeriodFilter, Paged } from '@/lib/admin/finance/types';
import { listChargebacks, updateChargeback } from '@/lib/admin/finance/api';

interface ChargebacksTableProps {
  period: PeriodFilter;
}

const statusColors: Record<ChargebackStatus, string> = {
  review: 'processing',
  approved: 'success',
  denied: 'error',
};

const statusLabels: Record<ChargebackStatus, string> = {
  review: 'Em Análise',
  approved: 'Aprovado',
  denied: 'Negado',
};

const methodLabels: Record<PaymentMethod, string> = {
  pix: 'PIX',
  card: 'Cartão',
  boleto: 'Boleto',
  transfer: 'Transferência',
};

export function ChargebacksTable({ period }: ChargebacksTableProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<ChargebackStatus | 'all'>('all');
  const [method, setMethod] = useState<PaymentMethod | 'all'>('all');

  const params = useMemo(
    () => ({
      page,
      pageSize,
      q,
      status: status === 'all' ? undefined : status,
      method: method === 'all' ? undefined : method,
      ...period,
    }),
    [page, pageSize, q, status, method, period]
  );

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'finance', 'chargebacks', params],
    queryFn: () => listChargebacks(params),
    placeholderData: keepPreviousData,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'denied' }) =>
      updateChargeback(id, status),
    onMutate: async ({ id, status: newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'finance', 'chargebacks'] });
      queryClient.setQueriesData({ queryKey: ['admin', 'finance', 'chargebacks'] }, (old: Paged<ChargebackItem> | undefined) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((cb: ChargebackItem) =>
            cb.id === id ? { ...cb, status: newStatus as ChargebackStatus } : cb
          ),
        };
      });
    },
    onSuccess: () => {
      message.success('Chargeback atualizado');
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'chargebacks'] });
    },
    onError: () => {
      message.error('Falha ao atualizar chargeback');
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'chargebacks'] });
    },
  });

  const handleApprove = (id: string) => {
    updateMutation.mutate({ id, status: 'approved' });
  };

  const handleDeny = (id: string) => {
    updateMutation.mutate({ id, status: 'denied' });
  };

  const columns: ColumnsType<ChargebackItem> = [
    {
      title: 'Data',
      dataIndex: 'createdAt',
      width: 140,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
      sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
    },
    {
      title: 'Cliente',
      dataIndex: 'customerName',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Método',
      dataIndex: 'method',
      width: 100,
      render: (v: PaymentMethod) => methodLabels[v],
    },
    {
      title: 'Valor',
      dataIndex: 'amount',
      width: 120,
      align: 'right',
      render: (v: number) =>
        v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      sorter: (a, b) => a.amount - b.amount,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (v: ChargebackStatus) => <Tag color={statusColors[v]}>{statusLabels[v]}</Tag>,
    },
    {
      title: 'Motivo',
      dataIndex: 'reason',
      width: 250,
      ellipsis: true,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Ações',
      key: 'actions',
      fixed: 'right',
      width: 180,
      render: (_, record) =>
        record.status === 'review' ? (
          <Space size="small">
            <Popconfirm
              title="Aprovar chargeback?"
              onConfirm={() => handleApprove(record.id)}
              okText="Sim"
              cancelText="Não"
            >
              <Button type="link" size="small" icon={<CheckOutlined />}>
                Aprovar
              </Button>
            </Popconfirm>
            <Popconfirm
              title="Negar chargeback?"
              onConfirm={() => handleDeny(record.id)}
              okText="Sim"
              cancelText="Não"
            >
              <Button type="link" size="small" danger icon={<CloseOutlined />}>
                Negar
              </Button>
            </Popconfirm>
          </Space>
        ) : null,
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex gap={8} wrap="wrap">
        <Input.Search
          placeholder="Buscar cliente, motivo..."
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          style={{ maxWidth: 300 }}
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
            { label: 'Em Análise', value: 'review' },
            { label: 'Aprovado', value: 'approved' },
            { label: 'Negado', value: 'denied' },
          ]}
        />
        <Select
          value={method}
          onChange={(v) => {
            setPage(1);
            setMethod(v);
          }}
          style={{ width: 150 }}
          options={[
            { label: 'Todos métodos', value: 'all' },
            { label: 'PIX', value: 'pix' },
            { label: 'Cartão', value: 'card' },
            { label: 'Boleto', value: 'boleto' },
            { label: 'Transferência', value: 'transfer' },
          ]}
        />
      </Flex>

      <Table<ChargebackItem>
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
        scroll={{ x: 1200, y: 'calc(100vh - 480px)' }}
      />
    </Flex>
  );
}
