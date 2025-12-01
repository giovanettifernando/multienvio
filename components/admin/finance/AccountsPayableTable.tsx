'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  Select,
  Flex,
  Button,
  Typography,
  Space,
  Empty,
  Spin,
  Card,
  Tag,
  Row,
  Col,
  Statistic,
  DatePicker,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import {
  DownloadOutlined,
  ReloadOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;

type PayableType = 'collector_commission' | 'pickup_point_commission' | 'carrier_cost' | 'expense';
type PayableStatus = 'pending' | 'paid';

interface PayableItem {
  id: string;
  type: PayableType;
  creditorName: string;
  description: string;
  dueDate: string | null;
  amountCents: number;
  amountReais: number;
  status: PayableStatus;
  referenceCode: string | null;
  createdAt: string;
  paidAt: string | null;
}

interface AccountsPayableResponse {
  period: {
    dateStart: string;
    dateEnd: string;
  };
  statusFilter: string;
  summary: {
    totalItems: number;
    totalAmountCents: number;
    totalAmountReais: number;
    pendingAmountCents: number;
    pendingAmountReais: number;
    paidAmountCents: number;
    paidAmountReais: number;
    byType: Record<PayableType, { count: number; amountCents: number; amountReais: number }>;
  };
  items: PayableItem[];
}

const PAYABLE_TYPE_LABELS: Record<PayableType, string> = {
  collector_commission: 'Comissão Coletor',
  pickup_point_commission: 'Comissão Ponto de Coleta',
  carrier_cost: 'Custo Transportadora',
  expense: 'Despesa',
};

const PAYABLE_TYPE_COLORS: Record<PayableType, string> = {
  collector_commission: 'blue',
  pickup_point_commission: 'purple',
  carrier_cost: 'orange',
  expense: 'default',
};

const STATUS_LABELS: Record<PayableStatus, string> = {
  pending: 'Pendente',
  paid: 'Pago',
};

const STATUS_COLORS: Record<PayableStatus, string> = {
  pending: 'orange',
  paid: 'green',
};

async function fetchAccountsPayable(params: {
  dateStart: string;
  dateEnd: string;
  status: string;
}): Promise<AccountsPayableResponse> {
  const searchParams = new URLSearchParams({
    dateStart: params.dateStart,
    dateEnd: params.dateEnd,
    status: params.status,
  });

  const res = await fetch(`/api/admin/finance/reports/accounts-payable?${searchParams}`, {
    credentials: 'include',
  });

  if (!res.ok) throw new Error('Erro ao carregar contas a pagar');
  return res.json();
}

function formatCurrency(valueReais: number): string {
  return valueReais.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return dayjs(dateStr).format('DD/MM/YYYY');
}

export function AccountsPayableTable() {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [status, setStatus] = useState<string>('all');

  const { data, isLoading, error, refetch } = useQuery<AccountsPayableResponse>({
    queryKey: [
      'admin',
      'finance',
      'accounts-payable',
      dateRange[0].format('YYYY-MM-DD'),
      dateRange[1].format('YYYY-MM-DD'),
      status,
    ],
    queryFn: () =>
      fetchAccountsPayable({
        dateStart: dateRange[0].format('YYYY-MM-DD'),
        dateEnd: dateRange[1].format('YYYY-MM-DD'),
        status,
      }),
  });

  const columns = useMemo<ColumnsType<PayableItem>>(
    () => [
      {
        title: 'Tipo',
        dataIndex: 'type',
        key: 'type',
        width: 140,
        filters: [
          { text: 'Comissão Coletor', value: 'collector_commission' },
          { text: 'Comissão Ponto', value: 'pickup_point_commission' },
          { text: 'Transportadora', value: 'carrier_cost' },
          { text: 'Despesa', value: 'expense' },
        ],
        onFilter: (value, record) => record.type === value,
        render: (type: PayableType) => (
          <Tag color={PAYABLE_TYPE_COLORS[type]} style={{ fontSize: 11 }}>
            {PAYABLE_TYPE_LABELS[type]}
          </Tag>
        ),
      },
      {
        title: 'Credor',
        dataIndex: 'creditorName',
        key: 'creditorName',
        width: 180,
        ellipsis: true,
        render: (name: string) => (
          <span style={{ fontSize: 12 }}>{name}</span>
        ),
      },
      {
        title: 'Descrição',
        dataIndex: 'description',
        key: 'description',
        ellipsis: true,
        render: (desc: string) => (
          <span style={{ fontSize: 12 }}>{desc}</span>
        ),
      },
      {
        title: 'Vencimento',
        dataIndex: 'dueDate',
        key: 'dueDate',
        width: 100,
        sorter: (a, b) => {
          const dateA = a.dueDate || a.createdAt;
          const dateB = b.dueDate || b.createdAt;
          return new Date(dateA).getTime() - new Date(dateB).getTime();
        },
        render: (dueDate: string | null) => (
          <span style={{ fontSize: 12 }}>{formatDate(dueDate)}</span>
        ),
      },
      {
        title: 'Valor',
        dataIndex: 'amountReais',
        key: 'amountReais',
        width: 110,
        align: 'right',
        sorter: (a, b) => a.amountReais - b.amountReais,
        render: (amount: number) => (
          <span style={{ fontSize: 12, fontWeight: 500 }}>
            R$ {formatCurrency(amount)}
          </span>
        ),
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 90,
        filters: [
          { text: 'Pendente', value: 'pending' },
          { text: 'Pago', value: 'paid' },
        ],
        onFilter: (value, record) => record.status === value,
        render: (status: PayableStatus) => (
          <Tag color={STATUS_COLORS[status]} style={{ fontSize: 11 }}>
            {STATUS_LABELS[status]}
          </Tag>
        ),
      },
    ],
    []
  );

  const handleExportCSV = () => {
    if (!data?.items?.length) return;

    const rows: string[] = [];

    // Cabeçalho
    rows.push(['Tipo', 'Credor', 'Descrição', 'Vencimento', 'Valor', 'Status', 'Referência', 'Data Criação', 'Data Pagamento'].join(';'));

    // Dados
    for (const item of data.items) {
      const row = [
        `"${PAYABLE_TYPE_LABELS[item.type]}"`,
        `"${item.creditorName}"`,
        `"${item.description}"`,
        formatDate(item.dueDate),
        (item.amountReais).toFixed(2).replace('.', ','),
        STATUS_LABELS[item.status],
        item.referenceCode || '',
        formatDate(item.createdAt),
        formatDate(item.paidAt),
      ];
      rows.push(row.join(';'));
    }

    const csvContent = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `contas-a-pagar-${dateRange[0].format('YYYY-MM-DD')}-${dateRange[1].format('YYYY-MM-DD')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const renderFilters = () => (
    <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
      <Space wrap size="middle">
        <Space size={4}>
          <Text type="secondary">Período:</Text>
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]]);
              }
            }}
            format="DD/MM/YYYY"
            allowClear={false}
          />
        </Space>
        <Space size={4}>
          <Text type="secondary">Status:</Text>
          <Select
            value={status}
            onChange={setStatus}
            style={{ width: 120 }}
            options={[
              { label: 'Todos', value: 'all' },
              { label: 'Pendentes', value: 'pending' },
              { label: 'Pagos', value: 'paid' },
            ]}
          />
        </Space>
      </Space>

      <Space>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => refetch()}
          loading={isLoading}
        >
          Atualizar
        </Button>
        <Button
          icon={<DownloadOutlined />}
          onClick={handleExportCSV}
          disabled={!data?.items?.length}
        >
          Exportar CSV
        </Button>
      </Space>
    </Flex>
  );

  const renderSummary = () => {
    if (!data?.summary) return null;

    const { summary } = data;

    return (
      <Card size="small">
        <Row gutter={[24, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title="Total de Itens"
              value={summary.totalItems}
              prefix={<FileTextOutlined />}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title="Valor Total"
              value={summary.totalAmountReais}
              precision={2}
              prefix={<DollarOutlined />}
              styles={{ content: { color: '#1890ff' } }}
              formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title="Pendentes"
              value={summary.pendingAmountReais}
              precision={2}
              prefix={<ClockCircleOutlined />}
              styles={{ content: { color: '#fa8c16' } }}
              formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title="Pagos"
              value={summary.paidAmountReais}
              precision={2}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { color: '#52c41a' } }}
              formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
          </Col>
        </Row>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <Flex vertical gap={12}>
        {renderFilters()}
        <Card>
          <Flex justify="center" align="center" style={{ minHeight: 300 }}>
            <Spin size="large" tip="Carregando contas a pagar..." />
          </Flex>
        </Card>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex vertical gap={12}>
        {renderFilters()}
        <Card>
          <Empty
            description={
              <Space direction="vertical">
                <Text>Erro ao carregar contas a pagar</Text>
                <Text type="secondary">
                  {error instanceof Error ? error.message : 'Erro desconhecido'}
                </Text>
              </Space>
            }
          />
        </Card>
      </Flex>
    );
  }

  return (
    <Flex vertical gap={12}>
      {renderFilters()}
      {renderSummary()}

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table<PayableItem>
          dataSource={data?.items || []}
          columns={columns}
          rowKey="id"
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100'],
            showTotal: (total) => `Total: ${total} itens`,
          }}
          scroll={{ x: 'max-content' }}
          size="small"
        />
      </Card>
    </Flex>
  );
}
