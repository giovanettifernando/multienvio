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
import { ELInput } from '@/shared/ui/ELInput';
import type { TableProps } from 'antd';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { CheckOutlined, CloseOutlined, LinkOutlined } from '@ant-design/icons';
import type { Invoice, InvoiceStatus, PeriodFilter, Paged } from '@/modules/admin/application/finance/types';
import { listInvoices, markInvoicePaid, cancelInvoice } from '@/modules/admin/application/finance/api';

interface InvoicesTableProps {
  period: PeriodFilter;
}

const statusColors: Record<InvoiceStatus, string> = {
  open: 'warning',
  paid: 'success',
  canceled: 'error',
};

const statusLabels: Record<InvoiceStatus, string> = {
  open: 'Aberta',
  paid: 'Paga',
  canceled: 'Cancelada',
};

export function InvoicesTable({ period }: InvoicesTableProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

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
    queryKey: ['admin', 'finance', 'invoices', params],
    queryFn: () => listInvoices(params),
    placeholderData: keepPreviousData,
  });

  const markPaidMutation = useMutation({
    mutationFn: markInvoicePaid,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'finance', 'invoices'] });
      queryClient.setQueriesData({ queryKey: ['admin', 'finance', 'invoices'] }, (old: Paged<Invoice> | undefined) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((inv: Invoice) =>
            inv.id === id ? { ...inv, status: 'paid' as InvoiceStatus } : inv
          ),
        };
      });
    },
    onSuccess: () => {
      message.success('Fatura marcada como paga');
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'invoices'] });
    },
    onError: () => {
      message.error('Falha ao marcar fatura como paga');
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'invoices'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelInvoice,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'finance', 'invoices'] });
      queryClient.setQueriesData({ queryKey: ['admin', 'finance', 'invoices'] }, (old: Paged<Invoice> | undefined) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((inv: Invoice) =>
            inv.id === id ? { ...inv, status: 'canceled' as InvoiceStatus } : inv
          ),
        };
      });
    },
    onSuccess: () => {
      message.success('Fatura cancelada');
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'invoices'] });
    },
    onError: () => {
      message.error('Falha ao cancelar fatura');
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'invoices'] });
    },
  });

  const handleMarkPaid = (id: string) => {
    markPaidMutation.mutate(id);
  };

  const handleCancel = (id: string) => {
    cancelMutation.mutate(id);
  };

  const handleMarkPaidBulk = () => {
    const ids = selectedRowKeys as string[];
    Promise.all(ids.map((id) => markInvoicePaid(id)))
      .then(() => {
        message.success(`${ids.length} fatura(s) marcada(s) como paga(s)`);
        setSelectedRowKeys([]);
        queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'invoices'] });
      })
      .catch(() => {
        message.error('Falha ao marcar faturas como pagas');
      });
  };

  const columns: TableProps<Invoice>['columns'] = [
    {
      title: 'Emissão',
      dataIndex: 'issueDate',
      width: 120,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
      sorter: (a, b) => dayjs(a.issueDate).valueOf() - dayjs(b.issueDate).valueOf(),
    },
    {
      title: 'Vencimento',
      dataIndex: 'dueDate',
      width: 120,
      render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
    },
    {
      title: 'ID',
      dataIndex: 'id',
      width: 120,
    },
    {
      title: 'Cliente',
      dataIndex: 'customerName',
      width: 200,
      ellipsis: true,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Valor',
      dataIndex: 'total',
      width: 120,
      align: 'right',
      render: (v: number) =>
        v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      sorter: (a, b) => a.total - b.total,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (v: InvoiceStatus) => <Tag color={statusColors[v]}>{statusLabels[v]}</Tag>,
    },
    {
      title: 'Link',
      dataIndex: 'link',
      width: 80,
      render: (v: string | null) =>
        v ? (
          <Button
            type="link"
            size="small"
            icon={<LinkOutlined />}
            href={v}
            target="_blank"
          >
            Abrir
          </Button>
        ) : (
          '—'
        ),
    },
    {
      title: 'Ações',
      key: 'actions',
      fixed: 'right',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          {record.status === 'open' && (
            <>
              <Popconfirm
                title="Marcar fatura como paga?"
                onConfirm={() => handleMarkPaid(record.id)}
                okText="Sim"
                cancelText="Não"
              >
                <Button type="link" size="small" icon={<CheckOutlined />}>
                  Marcar Paga
                </Button>
              </Popconfirm>
              <Popconfirm
                title="Cancelar fatura?"
                onConfirm={() => handleCancel(record.id)}
                okText="Sim"
                cancelText="Não"
              >
                <Button type="link" size="small" danger icon={<CloseOutlined />}>
                  Cancelar
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  const rowSelection: TableProps<Invoice>['rowSelection'] = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
    getCheckboxProps: (record) => ({
      disabled: record.status !== 'open',
    }),
  };

  const hasSelection = selectedRowKeys.length > 0;

  return (
    <Flex vertical gap={16}>
      <Flex gap={8} wrap="wrap">
        <ELInput.Search
          placeholder="Buscar ID, cliente..."
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
            { label: 'Aberta', value: 'open' },
            { label: 'Paga', value: 'paid' },
            { label: 'Cancelada', value: 'canceled' },
          ]}
        />
      </Flex>

      {hasSelection && (
        <Flex gap={8}>
          <Popconfirm
            title={`Marcar ${selectedRowKeys.length} fatura(s) como paga(s)?`}
            onConfirm={handleMarkPaidBulk}
            okText="Sim"
            cancelText="Não"
          >
            <Button type="primary" icon={<CheckOutlined />}>
              Marcar Pagas ({selectedRowKeys.length})
            </Button>
          </Popconfirm>
        </Flex>
      )}

      <Table<Invoice>
        rowKey="id"
        dataSource={data?.items ?? []}
        columns={columns}
        rowSelection={rowSelection}
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
