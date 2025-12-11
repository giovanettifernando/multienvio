'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  Flex,
  Input,
  Button,
  Popconfirm,
  App,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/lib/table/interface';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { CheckOutlined } from '@ant-design/icons';
import type { LedgerEntry, PaymentMethod, PeriodFilter } from '@/lib/admin/finance/types';
import { listUnreconciled, markReconciled } from '@/lib/admin/finance/api';

const { Text } = Typography;

interface ReconciliationTableProps {
  period: PeriodFilter;
}

const methodLabels: Record<PaymentMethod, string> = {
  pix: 'PIX',
  card: 'Cartão',
  boleto: 'Boleto',
  transfer: 'Transferência',
};

export function ReconciliationTable({ period }: ReconciliationTableProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const params = useMemo(
    () => ({
      page,
      pageSize,
      q,
      ...period,
    }),
    [page, pageSize, q, period]
  );

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'finance', 'reconciliation', params],
    queryFn: () => listUnreconciled(params),
    placeholderData: keepPreviousData,
  });

  const markReconciledMutation = useMutation({
    mutationFn: markReconciled,
    onSuccess: () => {
      message.success('Entradas marcadas como conciliadas');
      setSelectedRowKeys([]);
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'ledger'] });
    },
    onError: () => {
      message.error('Falha ao conciliar entradas');
    },
  });

  const handleMarkReconciled = (ids: string[]) => {
    markReconciledMutation.mutate(ids);
  };

  const columns: ColumnsType<LedgerEntry> = [
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
      title: 'Meio',
      dataIndex: 'method',
      width: 120,
      render: (v: PaymentMethod | null) => v ? methodLabels[v] : '—',
    },
    {
      title: 'Valor',
      dataIndex: 'amount',
      width: 130,
      align: 'right',
      render: (v: number, record) => (
        <span style={{ color: record.nature === 'credit' ? '#3f8600' : '#cf1322', fontWeight: 'bold' }}>
          {record.nature === 'credit' ? '+' : '-'}
          {v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
      ),
      sorter: (a, b) => a.amount - b.amount,
    },
    {
      title: 'Referência/Descrição',
      dataIndex: 'description',
      width: 250,
      ellipsis: true,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Ações',
      key: 'actions',
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Popconfirm
          title="Marcar como conciliado?"
          onConfirm={() => handleMarkReconciled([record.id])}
          okText="Sim"
          cancelText="Não"
        >
          <Button type="link" size="small" icon={<CheckOutlined />}>
            Conciliar
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const rowSelection: TableRowSelection<LedgerEntry> = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  const hasSelection = selectedRowKeys.length > 0;
  const selectedIds = selectedRowKeys as string[];

  // Calculate total difference
  const items = data?.items;
  const totalDifference = useMemo(() => {
    if (!items) return 0;
    return items.reduce((sum, entry) => {
      const amount = entry.nature === 'credit' ? entry.amount : -entry.amount;
      return sum + amount;
    }, 0);
  }, [items]);

  return (
    <Flex vertical gap={16}>
      <Flex gap={8} wrap="wrap" justify="space-between">
        <Input.Search
          placeholder="Buscar cliente, descrição..."
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          style={{ maxWidth: 300 }}
        />
        <Text strong>
          Diferença Total:{' '}
          <span style={{ color: totalDifference >= 0 ? '#3f8600' : '#cf1322' }}>
            {totalDifference.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </Text>
      </Flex>

      {hasSelection && (
        <Flex gap={8}>
          <Popconfirm
            title={`Marcar ${selectedIds.length} entrada(s) como conciliada(s)?`}
            onConfirm={() => handleMarkReconciled(selectedIds)}
            okText="Sim"
            cancelText="Não"
          >
            <Button type="primary" icon={<CheckOutlined />}>
              Marcar Conciliado ({selectedIds.length})
            </Button>
          </Popconfirm>
        </Flex>
      )}

      <Table<LedgerEntry>
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
          showTotal: (total) => `Total: ${total} não conciliados`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
        scroll={{ x: 1000, y: 'calc(100vh - 480px)' }}
      />
    </Flex>
  );
}
