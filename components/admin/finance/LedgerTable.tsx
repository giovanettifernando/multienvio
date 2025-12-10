'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  Flex,
  Input,
  Select,
  Button,
  Tag,
  Popconfirm,
  Modal,
  Form,
  InputNumber,
  App,
} from 'antd';
import { inputNumberFormatterBRL, inputNumberParserBRL } from '@/lib/utils/format';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/lib/table/interface';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { DownloadOutlined, PlusOutlined, CheckOutlined } from '@ant-design/icons';
import type { LedgerEntry, LedgerKind, TxNature, PaymentMethod, PeriodFilter, Paged } from '@/lib/admin/finance/types';
import { listLedger, reconcileLedger, createAdjustment } from '@/lib/admin/finance/api';

interface LedgerTableProps {
  period: PeriodFilter;
}

const kindLabels: Record<LedgerKind, string> = {
  deposit: 'Depósito',
  purchase: 'Compra',
  fee: 'Taxa',
  refund: 'Estorno',
  chargeback: 'Chargeback',
  commission: 'Comissão',
  carrier_payout: 'Repasse',
  adjustment: 'Ajuste',
};

const kindColors: Record<LedgerKind, string> = {
  deposit: 'green',
  purchase: 'blue',
  fee: 'orange',
  refund: 'purple',
  chargeback: 'red',
  commission: 'cyan',
  carrier_payout: 'magenta',
  adjustment: 'gold',
};

const methodLabels: Record<PaymentMethod, string> = {
  pix: 'PIX',
  card: 'Cartão',
  boleto: 'Boleto',
  transfer: 'Transferência',
};

export function LedgerTable({ period }: LedgerTableProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<LedgerKind | 'all'>('all');
  const [method, setMethod] = useState<PaymentMethod | 'all'>('all');
  const [reconciled, setReconciled] = useState<'all' | 'true' | 'false'>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [adjustmentForm] = Form.useForm();

  const params = useMemo(
    () => ({
      page,
      pageSize,
      q,
      kind: kind === 'all' ? undefined : kind,
      method: method === 'all' ? undefined : method,
      reconciled: reconciled === 'all' ? undefined : reconciled === 'true',
      ...period,
    }),
    [page, pageSize, q, kind, method, reconciled, period]
  );

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'finance', 'ledger', params],
    queryFn: () => listLedger(params),
    placeholderData: keepPreviousData,
  });

  const reconcileMutation = useMutation({
    mutationFn: reconcileLedger,
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'finance', 'ledger'] });
      queryClient.setQueriesData({ queryKey: ['admin', 'finance', 'ledger'] }, (old: Paged<LedgerEntry> | undefined) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((e: LedgerEntry) =>
            ids.includes(e.id) ? { ...e, reconciled: true } : e
          ),
        };
      });
    },
    onSuccess: () => {
      message.success('Entradas conciliadas com sucesso');
      setSelectedRowKeys([]);
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'ledger'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'reconciliation'] });
    },
    onError: () => {
      message.error('Falha ao conciliar entradas');
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'ledger'] });
    },
  });

  const adjustmentMutation = useMutation({
    mutationFn: createAdjustment,
    onSuccess: () => {
      message.success('Ajuste criado com sucesso');
      setAdjustmentModalOpen(false);
      adjustmentForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'ledger'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'summary'] });
    },
    onError: () => {
      message.error('Falha ao criar ajuste');
    },
  });

  const handleReconcile = (ids: string[]) => {
    reconcileMutation.mutate(ids);
  };

  const handleCreateAdjustment = async () => {
    try {
      const values = await adjustmentForm.validateFields();
      adjustmentMutation.mutate({
        customerId: values.customerId,
        customerName: values.customerName,
        kind: 'adjustment',
        nature: values.nature,
        amount: values.amount,
        description: values.description,
        reconciled: false,
        createdAt: new Date().toISOString(),
        method: null,
        carrier: null,
        shipmentId: null,
        fee: null,
      });
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleExportCSV = () => {
    const items = data?.items || [];
    const csv = [
      'Data,Cliente,Tipo,Natureza,Método,Transportadora,Envio,Valor,Taxa,Descrição,Reconciliado',
      ...items.map((e) =>
        [
          dayjs(e.createdAt).format('DD/MM/YYYY HH:mm'),
          e.customerName,
          kindLabels[e.kind],
          e.nature === 'credit' ? 'Crédito' : 'Débito',
          e.method ? methodLabels[e.method] : '',
          e.carrier || '',
          e.shipmentId || '',
          e.amount.toFixed(2),
          e.fee?.toFixed(2) || '',
          e.description || '',
          e.reconciled ? 'Sim' : 'Não',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ledger-${Date.now()}.csv`;
    link.click();
  };

  const columns: ColumnsType<LedgerEntry> = [
    {
      title: 'Criada em',
      dataIndex: 'createdAt',
      width: 140,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
      sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
    },
    {
      title: 'Cliente',
      dataIndex: 'customerName',
      width: 180,
      ellipsis: true,
    },
    {
      title: 'Tipo',
      dataIndex: 'kind',
      width: 120,
      render: (v: LedgerKind) => <Tag color={kindColors[v]}>{kindLabels[v]}</Tag>,
    },
    {
      title: 'Natureza',
      dataIndex: 'nature',
      width: 100,
      render: (v: TxNature) => (
        <Tag color={v === 'credit' ? 'green' : 'red'}>
          {v === 'credit' ? 'Crédito' : 'Débito'}
        </Tag>
      ),
    },
    {
      title: 'Meio',
      dataIndex: 'method',
      width: 120,
      render: (v: PaymentMethod | null) => v ? methodLabels[v] : '—',
    },
    {
      title: 'Transportadora',
      dataIndex: 'carrier',
      width: 130,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Envio',
      dataIndex: 'shipmentId',
      width: 120,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Valor',
      dataIndex: 'amount',
      width: 120,
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
      title: 'Taxa',
      dataIndex: 'fee',
      width: 100,
      align: 'right',
      render: (v: number | null) =>
        v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—',
    },
    {
      title: 'Descrição',
      dataIndex: 'description',
      width: 200,
      ellipsis: true,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Reconciliado',
      dataIndex: 'reconciled',
      width: 110,
      render: (v: boolean) => (
        <Tag color={v ? 'success' : 'default'}>{v ? 'Sim' : 'Não'}</Tag>
      ),
    },
  ];

  const rowSelection: TableRowSelection<LedgerEntry> = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  const hasSelection = selectedRowKeys.length > 0;
  const selectedIds = selectedRowKeys as string[];

  return (
    <Flex vertical gap={16}>
      <Flex gap={8} wrap="wrap">
        <Input.Search
          placeholder="Buscar cliente, descrição..."
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          style={{ maxWidth: 300 }}
        />
        <Select
          value={kind}
          onChange={(v) => {
            setPage(1);
            setKind(v);
          }}
          style={{ width: 150 }}
          options={[
            { label: 'Todos os tipos', value: 'all' },
            { label: 'Depósito', value: 'deposit' },
            { label: 'Compra', value: 'purchase' },
            { label: 'Taxa', value: 'fee' },
            { label: 'Estorno', value: 'refund' },
            { label: 'Chargeback', value: 'chargeback' },
            { label: 'Comissão', value: 'commission' },
            { label: 'Repasse', value: 'carrier_payout' },
            { label: 'Ajuste', value: 'adjustment' },
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
            { label: 'Todos os meios', value: 'all' },
            { label: 'PIX', value: 'pix' },
            { label: 'Cartão', value: 'card' },
            { label: 'Boleto', value: 'boleto' },
            { label: 'Transferência', value: 'transfer' },
          ]}
        />
        <Select
          value={reconciled}
          onChange={(v) => {
            setPage(1);
            setReconciled(v);
          }}
          style={{ width: 150 }}
          options={[
            { label: 'Todos', value: 'all' },
            { label: 'Reconciliado', value: 'true' },
            { label: 'Não reconciliado', value: 'false' },
          ]}
        />
        <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
          Exportar CSV
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdjustmentModalOpen(true)}>
          Novo Ajuste
        </Button>
      </Flex>

      {hasSelection && (
        <Flex gap={8}>
          <Popconfirm
            title={`Marcar ${selectedIds.length} entrada(s) como conciliada(s)?`}
            onConfirm={() => handleReconcile(selectedIds)}
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
          showTotal: (total) => `Total: ${total}`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
        scroll={{ x: 1500 }}
      />

      <Modal
        title="Novo Ajuste Manual"
        open={adjustmentModalOpen}
        onOk={handleCreateAdjustment}
        onCancel={() => {
          setAdjustmentModalOpen(false);
          adjustmentForm.resetFields();
        }}
        confirmLoading={adjustmentMutation.isPending}
      >
        <Form form={adjustmentForm} layout="vertical">
          <Form.Item name="customerId" label="ID do Cliente" rules={[{ required: true }]}>
            <Input placeholder="cli_001" />
          </Form.Item>
          <Form.Item name="customerName" label="Nome do Cliente" rules={[{ required: true }]}>
            <Input placeholder="Nome ou Razão Social" />
          </Form.Item>
          <Form.Item name="nature" label="Natureza" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'Crédito', value: 'credit' },
                { label: 'Débito', value: 'debit' },
              ]}
            />
          </Form.Item>
          <Form.Item name="amount" label="Valor (R$)" rules={[{ required: true }]}>
            <InputNumber
              min={0}
              step={0.01}
              precision={2}
              style={{ width: '100%' }}
              prefix="R$"
              decimalSeparator=","
              formatter={inputNumberFormatterBRL}
              parser={inputNumberParserBRL}
            />
          </Form.Item>
          <Form.Item name="description" label="Descrição">
            <Input.TextArea rows={3} placeholder="Motivo do ajuste..." />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
