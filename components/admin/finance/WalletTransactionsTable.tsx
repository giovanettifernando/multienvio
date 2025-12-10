'use client';

import { useState, useMemo } from 'react';
import { Table, Flex, Input, Select, Button, Tag, Card, Statistic, Row, Col, DatePicker, Modal, Descriptions } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import type { Paged } from '@/lib/admin/finance/types';
import type { AdminWalletTransaction } from '@/app/api/admin/finance/wallet-transactions/route';
import type { WalletTxType } from '@prisma/client';

const { RangePicker } = DatePicker;

// Only these types are used in the wallet
const typeLabels: Partial<Record<WalletTxType, string>> = {
  TOPUP: 'Recarga',
  PURCHASE: 'Compra',
  ADJUSTMENT: 'Ajuste',
};

const typeColors: Partial<Record<WalletTxType, string>> = {
  TOPUP: 'green',
  PURCHASE: 'blue',
  ADJUSTMENT: 'gold',
};

// Format currency in Brazilian Real format
function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface ApiResponse extends Paged<AdminWalletTransaction> {
  summary: {
    totalCredits: number;
    totalDebits: number;
    netAmount: number;
    transactionCount: number;
  };
}

async function listWalletTransactions(params: {
  page?: number;
  pageSize?: number;
  q?: string;
  type?: WalletTxType | 'all';
  dateStart?: string;
  dateEnd?: string;
}): Promise<ApiResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString());
  if (params.q) searchParams.set('q', params.q);
  if (params.type && params.type !== 'all') searchParams.set('type', params.type);
  if (params.dateStart) searchParams.set('dateStart', params.dateStart);
  if (params.dateEnd) searchParams.set('dateEnd', params.dateEnd);

  const res = await fetch(`/api/admin/finance/wallet-transactions?${searchParams}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch wallet transactions');
  const json = await res.json();
  // API returns { data: { items, ... } } format
  return json.data ?? json;
}

type Direction = 'all' | 'credit' | 'debit';

export function WalletTransactionsTable() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [q, setQ] = useState('');
  const [type, setType] = useState<WalletTxType | 'all'>('all');
  const [direction, setDirection] = useState<Direction>('all');
  const [detailsModal, setDetailsModal] = useState<AdminWalletTransaction | null>(null);

  // Own period filter - default: first day of month to today
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(() => [
    dayjs().startOf('month'),
    dayjs().endOf('day'),
  ]);

  const period = useMemo(() => ({
    dateStart: dateRange[0].startOf('day').toISOString(),
    dateEnd: dateRange[1].endOf('day').toISOString(),
  }), [dateRange]);

  const params = useMemo(
    () => ({
      page,
      pageSize,
      q,
      type: type === 'all' ? undefined : type,
      ...period,
    }),
    [page, pageSize, q, type, period]
  );

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'finance', 'wallet-transactions', params],
    queryFn: () => listWalletTransactions(params),
    placeholderData: keepPreviousData,
  });

  // Client-side filtering for direction (API doesn't support it yet)
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (direction === 'all') return data.items;
    return data.items.filter((item) => item.direction === direction);
  }, [data, direction]);

  const handleExportCSV = () => {
    const csv = [
      'Data;Cliente;Tipo;Direção;Valor;Título',
      ...filteredItems.map((e) =>
        [
          dayjs(e.confirmedAt).format('DD/MM/YYYY HH:mm'),
          e.customerName,
          typeLabels[e.type] || e.type,
          e.direction === 'credit' ? 'Crédito' : 'Débito',
          e.amountReais.toFixed(2).replace('.', ','),
          e.title || '',
        ].join(';')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `movimentacoes-${Date.now()}.csv`;
    link.click();
  };

  const columns: ColumnsType<AdminWalletTransaction> = [
    {
      title: 'Data',
      dataIndex: 'confirmedAt',
      width: 160,
      render: (v: string | null) => (
        <span style={{ whiteSpace: 'nowrap', display: 'inline-block' }}>
          {v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '-'}
        </span>
      ),
      sorter: (a, b) =>
        dayjs(a.confirmedAt || a.createdAt).valueOf() -
        dayjs(b.confirmedAt || b.createdAt).valueOf(),
    },
    {
      title: 'Cliente',
      dataIndex: 'customerName',
      width: 220,
      ellipsis: true,
    },
    {
      title: 'Tipo',
      dataIndex: 'type',
      width: 100,
      render: (v: WalletTxType) => <Tag color={typeColors[v] || 'default'}>{typeLabels[v] || v}</Tag>,
    },
    {
      title: 'Direção',
      dataIndex: 'direction',
      width: 100,
      render: (v: 'credit' | 'debit') => (
        <Tag color={v === 'credit' ? 'green' : 'red'}>
          {v === 'credit' ? 'Crédito' : 'Débito'}
        </Tag>
      ),
    },
    {
      title: 'Valor',
      dataIndex: 'formattedAmount',
      width: 130,
      align: 'right',
      render: (formatted: string, record) => (
        <span
          style={{
            color: record.direction === 'credit' ? '#3f8600' : '#cf1322',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
          }}
        >
          {formatted}
        </span>
      ),
      sorter: (a, b) => a.amountCents - b.amountCents,
    },
    {
      title: 'Título',
      dataIndex: 'title',
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 80,
      align: 'center',
      render: (_: unknown, record: AdminWalletTransaction) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          onClick={() => setDetailsModal(record)}
          title="Ver detalhes"
        />
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      {/* Summary Card */}
      {data?.summary && (
        <Card size="small">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title="Total Créditos"
                value={`R$ ${formatBRL(data.summary.totalCredits)}`}
                styles={{ content: { color: '#3f8600' } }}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title="Total Débitos"
                value={`R$ ${formatBRL(data.summary.totalDebits)}`}
                styles={{ content: { color: '#cf1322' } }}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title="Saldo Líquido"
                value={`R$ ${formatBRL(data.summary.netAmount)}`}
                styles={{ content: {
                  color: data.summary.netAmount >= 0 ? '#3f8600' : '#cf1322',
                  fontWeight: 'bold',
                } }}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title="Total Transações"
                value={data.summary.transactionCount}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* Filters */}
      <Flex gap={8} wrap="wrap" align="center">
        <RangePicker
          value={dateRange}
          onChange={(dates) => {
            if (dates && dates[0] && dates[1]) {
              setPage(1);
              setDateRange([dates[0], dates[1]]);
            }
          }}
          format="DD/MM/YYYY"
          allowClear={false}
          presets={[
            { label: 'Hoje', value: [dayjs().startOf('day'), dayjs().endOf('day')] },
            { label: 'Últimos 7 dias', value: [dayjs().subtract(7, 'days').startOf('day'), dayjs().endOf('day')] },
            { label: 'Últimos 30 dias', value: [dayjs().subtract(30, 'days').startOf('day'), dayjs().endOf('day')] },
            { label: 'Mês atual', value: [dayjs().startOf('month'), dayjs().endOf('day')] },
          ]}
        />
        <Input.Search
          placeholder="Buscar cliente, título, referência..."
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          style={{ maxWidth: 280 }}
        />
        <Select
          value={type}
          onChange={(v) => {
            setPage(1);
            setType(v);
          }}
          style={{ width: 140 }}
          options={[
            { label: 'Todos os tipos', value: 'all' },
            { label: 'Recarga', value: 'TOPUP' },
            { label: 'Compra', value: 'PURCHASE' },
            { label: 'Ajuste', value: 'ADJUSTMENT' },
          ]}
        />
        <Select
          value={direction}
          onChange={(v) => {
            setPage(1);
            setDirection(v);
          }}
          style={{ width: 130 }}
          options={[
            { label: 'Todas direções', value: 'all' },
            { label: 'Crédito', value: 'credit' },
            { label: 'Débito', value: 'debit' },
          ]}
        />
        <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
          Exportar CSV
        </Button>
      </Flex>

      {/* Table */}
      <Table<AdminWalletTransaction>
        rowKey="id"
        dataSource={filteredItems}
        columns={columns}
        loading={isLoading}
        pagination={{
          current: page,
          pageSize,
          total: direction === 'all' ? (data?.total ?? 0) : filteredItems.length,
          showSizeChanger: true,
          showTotal: (total) => `Total: ${total}`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
        scroll={{ x: 'max-content' }}
      />

      {/* Details Modal */}
      <Modal
        title="Detalhes da Transação"
        open={!!detailsModal}
        onCancel={() => setDetailsModal(null)}
        footer={[
          <Button key="close" onClick={() => setDetailsModal(null)}>
            Fechar
          </Button>,
        ]}
        width={600}
      >
        {detailsModal && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="ID">{detailsModal.id}</Descriptions.Item>
            <Descriptions.Item label="Cliente">{detailsModal.customerName}</Descriptions.Item>
            <Descriptions.Item label="ID do Cliente">{detailsModal.customerId}</Descriptions.Item>
            <Descriptions.Item label="Tipo">
              <Tag color={typeColors[detailsModal.type] || 'default'}>
                {typeLabels[detailsModal.type] || detailsModal.type}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Direção">
              <Tag color={detailsModal.direction === 'credit' ? 'green' : 'red'}>
                {detailsModal.direction === 'credit' ? 'Crédito' : 'Débito'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Valor">
              <span
                style={{
                  color: detailsModal.direction === 'credit' ? '#3f8600' : '#cf1322',
                  fontWeight: 'bold',
                }}
              >
                {detailsModal.formattedAmount}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Valor (centavos)">{detailsModal.amountCents}</Descriptions.Item>
            <Descriptions.Item label="Título">{detailsModal.title || '—'}</Descriptions.Item>
            <Descriptions.Item label="Referência">{detailsModal.referenceId || '—'}</Descriptions.Item>
            <Descriptions.Item label="ID Mercado Pago">{detailsModal.mercadoPagoId || '—'}</Descriptions.Item>
            <Descriptions.Item label="Status">{detailsModal.status}</Descriptions.Item>
            <Descriptions.Item label="Data de Criação">
              {dayjs(detailsModal.createdAt).format('DD/MM/YYYY HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="Data de Confirmação">
              {detailsModal.confirmedAt
                ? dayjs(detailsModal.confirmedAt).format('DD/MM/YYYY HH:mm:ss')
                : '—'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </Flex>
  );
}
