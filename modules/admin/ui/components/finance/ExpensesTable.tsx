'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  Flex,
  Select,
  Card,
  Statistic,
  Row,
  Col,
  Button,
  Typography,
  Tag,
  Space,
  Empty,
  Spin,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Upload,
  Popconfirm,
  message,
  Switch,
  Tooltip,
  TreeSelect,
} from 'antd';
import { ELModal } from '@/shared/ui/ELModal';
import { ELInput } from '@/shared/ui/ELInput';
import { inputNumberFormatterBRL, inputNumberParserBRL, formatBRL } from '@/shared/utils/format';
import { formatDateBR } from '@/shared/utils/date';
import type { TableProps } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  DownloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  UploadOutlined,
  EyeOutlined,
  SyncOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import type {
  Expense,
  ExpenseStatus,
  CreateExpenseData,
  UpdateExpenseData,
} from '@/modules/admin/application/finance/expenses';
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  markExpensePaid,
  EXPENSE_STATUS_LABELS,
} from '@/modules/admin/application/finance/expenses';
import { DRE_CHART_OF_ACCOUNTS } from '@/modules/admin/application/finance/dre';

const { Text } = Typography;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

type PeriodPreset = 'today' | '7d' | '30d' | 'month' | 'lastMonth' | 'custom';

const STATUS_COLORS: Record<ExpenseStatus, string> = {
  PENDING: 'gold',
  PAID: 'green',
  CANCELED: 'red',
};

// Construir árvore de contas DRE para despesas (códigos 2.0 em diante, excluindo totais calculados)
const buildDREAccountTree = () => {
  const expenseAccounts = DRE_CHART_OF_ACCOUNTS.filter(
    (acc) => !acc.isTotal && acc.code.match(/^[2-9]\./) && acc.type !== 'group'
  );

  // Agrupar por grupo principal
  const groups: Record<string, { title: string; value: string; selectable: boolean; children: { title: string; value: string; children?: { title: string; value: string }[] }[] }> = {};

  for (const acc of DRE_CHART_OF_ACCOUNTS) {
    if (acc.level === 1 && acc.type === 'group' && !acc.isTotal && acc.code.match(/^[2-9]\./)) {
      groups[acc.code] = {
        title: `${acc.code} ${acc.name}`,
        value: acc.code,
        selectable: false,
        children: [],
      };
    }
  }

  // Adicionar subgrupos e contas
  for (const acc of expenseAccounts) {
    const groupCode = acc.code.split('.')[0] + '.0';
    if (!groups[groupCode]) continue;

    if (acc.level === 2) {
      groups[groupCode].children.push({
        title: `${acc.code} ${acc.name}`,
        value: acc.code,
        children: [],
      });
    } else if (acc.level === 3) {
      const subgroupCode = acc.code.split('.').slice(0, 2).join('.');
      const subgroup = groups[groupCode].children.find((c) => c.value === subgroupCode);
      if (subgroup) {
        if (!subgroup.children) subgroup.children = [];
        subgroup.children.push({
          title: `${acc.code} ${acc.name}`,
          value: acc.code,
        });
      }
    }
  }

  return Object.values(groups);
};

const DRE_ACCOUNT_TREE = buildDREAccountTree();

// Obter nome da conta DRE pelo código
const getDREAccountName = (code: string | null): string => {
  if (!code) return '-';
  const account = DRE_CHART_OF_ACCOUNTS.find((acc) => acc.code === code);
  return account ? `${code} ${account.name}` : code;
};

interface ExpenseFormValues {
  dreAccountCode: string;
  description: string;
  amountReais: number;
  status: ExpenseStatus;
  dueDate: dayjs.Dayjs | null;
  paidAt: dayjs.Dayjs | null;
  reference: string;
  supplier: string;
  notes: string;
  isRecurring: boolean;
  recurringMonths: number | null;
}

export function ExpensesTable() {
  const queryClient = useQueryClient();
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month');
  const [customRange, setCustomRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [dreAccountFilter, setDreAccountFilter] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [form] = Form.useForm<ExpenseFormValues>();

  // Calcular período
  const period = useMemo(() => {
    const now = dayjs();
    switch (periodPreset) {
      case 'today':
        return {
          dateStart: now.startOf('day').toISOString(),
          dateEnd: now.endOf('day').toISOString(),
        };
      case '7d':
        return {
          dateStart: now.subtract(7, 'days').startOf('day').toISOString(),
          dateEnd: now.endOf('day').toISOString(),
        };
      case '30d':
        return {
          dateStart: now.subtract(30, 'days').startOf('day').toISOString(),
          dateEnd: now.endOf('day').toISOString(),
        };
      case 'month':
        return {
          dateStart: now.startOf('month').toISOString(),
          dateEnd: now.endOf('day').toISOString(),
        };
      case 'lastMonth':
        return {
          dateStart: now.subtract(1, 'month').startOf('month').toISOString(),
          dateEnd: now.subtract(1, 'month').endOf('month').toISOString(),
        };
      case 'custom':
        if (customRange) {
          return {
            dateStart: customRange[0].startOf('day').toISOString(),
            dateEnd: customRange[1].endOf('day').toISOString(),
          };
        }
        return {};
      default:
        return {};
    }
  }, [periodPreset, customRange]);

  const hasValidPeriod = Boolean(period.dateStart && period.dateEnd);

  // Query
  const { data, isLoading, error } = useQuery({
    queryKey: [
      'admin',
      'finance',
      'expenses',
      period,
      dreAccountFilter,
      statusFilter,
      searchQuery,
      page,
      pageSize,
    ],
    queryFn: () =>
      listExpenses({
        ...period,
        status: statusFilter === 'all' ? undefined : statusFilter,
        q: searchQuery || undefined,
        page,
        pageSize,
      }),
    enabled: hasValidPeriod,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      message.success('Despesa criada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'expenses'] });
      handleCloseModal();
    },
    onError: (err: Error) => {
      message.error(err.message || 'Erro ao criar despesa');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExpenseData }) =>
      updateExpense(id, data),
    onSuccess: () => {
      message.success('Despesa atualizada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'expenses'] });
      handleCloseModal();
    },
    onError: (err: Error) => {
      message.error(err.message || 'Erro ao atualizar despesa');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      message.success('Despesa removida com sucesso');
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'expenses'] });
    },
    onError: (err: Error) => {
      message.error(err.message || 'Erro ao remover despesa');
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: markExpensePaid,
    onSuccess: () => {
      message.success('Pagamento registrado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'expenses'] });
    },
    onError: (err: Error) => {
      message.error(err.message || 'Erro ao registrar pagamento');
    },
  });

  // Modal handlers
  const handleOpenCreate = () => {
    setEditingExpense(null);
    setReceiptFile(null);
    setRemoveReceipt(false);
    form.resetFields();
    form.setFieldsValue({
      status: 'PENDING',
      isRecurring: false,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setReceiptFile(null);
    setRemoveReceipt(false);
    form.setFieldsValue({
      dreAccountCode: expense.dreAccountCode || '',
      description: expense.description,
      amountReais: expense.amountReais,
      status: expense.status,
      dueDate: expense.dueDate ? dayjs(expense.dueDate) : null,
      paidAt: expense.paidAt ? dayjs(expense.paidAt) : null,
      reference: expense.reference || '',
      supplier: expense.supplier || '',
      notes: expense.notes || '',
      isRecurring: expense.isRecurring,
      recurringMonths: expense.recurringMonths,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
    setReceiptFile(null);
    setRemoveReceipt(false);
    form.resetFields();
  };

  const handleSubmit = async (values: ExpenseFormValues) => {
    // Determinar tipo e categoria baseado no código DRE
    const dreCode = values.dreAccountCode;
    const majorCode = dreCode ? parseInt(dreCode.split('.')[0], 10) : 7;

    // Mapear código DRE para tipo (FIXED vs VARIABLE)
    // Códigos 2, 3, 9 são variáveis, outros são fixos
    const isVariable = [2, 3, 9].includes(majorCode);
    const type = isVariable ? 'VARIABLE' : 'FIXED';

    // Mapear código DRE para categoria
    let category: string = 'OUTROS';
    if (majorCode === 2) category = 'IMPOSTOS';
    else if (majorCode === 3) category = 'GATEWAY';
    else if (majorCode === 4) category = 'MARKETING';
    else if (majorCode === 5) category = 'LOGISTICA';
    else if (majorCode === 6) category = 'INFRAESTRUTURA';
    else if (majorCode === 7) category = 'ADMINISTRATIVO';
    else if (majorCode === 8) category = 'SOFTWARE';
    else if (majorCode === 9) category = 'GATEWAY';
    else if (majorCode === 10) category = 'IMPOSTOS';

    const baseData = {
      type: type as 'FIXED' | 'VARIABLE',
      category: category as 'INFRAESTRUTURA' | 'SOFTWARE' | 'GATEWAY' | 'MARKETING' | 'PESSOAL' | 'ADMINISTRATIVO' | 'LOGISTICA' | 'IMPOSTOS' | 'OUTROS',
      dreAccountCode: values.dreAccountCode || null,
      description: values.description,
      amountCents: Math.round(values.amountReais * 100),
      status: values.status,
      dueDate: values.dueDate?.toISOString() || null,
      paidAt: values.paidAt?.toISOString() || null,
      reference: values.reference || null,
      supplier: values.supplier || null,
      notes: values.notes || null,
      isRecurring: values.isRecurring,
      recurringMonths: values.recurringMonths,
      receipt: receiptFile,
    };

    if (editingExpense) {
      updateMutation.mutate({
        id: editingExpense.id,
        data: { ...baseData, removeReceipt },
      });
    } else {
      createMutation.mutate(baseData as CreateExpenseData);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!data?.items) return;

    const rows: string[] = [];
    rows.push(
      [
        'Data',
        'Conta DRE',
        'Descricao',
        'Fornecedor',
        'Valor (R$)',
        'Status',
        'Vencimento',
        'Pago em',
        'Referencia',
      ].join(';')
    );

    for (const expense of data.items) {
      rows.push(
        [
          dayjs(expense.createdAt).format('DD/MM/YYYY'),
          getDREAccountName(expense.dreAccountCode),
          expense.description,
          expense.supplier || '',
          expense.amountReais.toFixed(2).replace('.', ','),
          EXPENSE_STATUS_LABELS[expense.status],
          expense.dueDate ? dayjs(expense.dueDate).format('DD/MM/YYYY') : '',
          expense.paidAt ? dayjs(expense.paidAt).format('DD/MM/YYYY') : '',
          expense.reference || '',
        ].join(';')
      );
    }

    const csvContent = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `despesas-${dayjs().format('YYYY-MM-DD')}.csv`;
    link.click();
  };

  // Table columns
  const columns: TableProps<Expense>['columns'] = [
    {
      title: 'Data',
      dataIndex: 'createdAt',
      width: 100,
      render: (v: string) => dayjs(v).format('DD/MM/YY'),
    },
    {
      title: 'Conta DRE',
      dataIndex: 'dreAccountCode',
      width: 280,
      ellipsis: true,
      render: (v: string | null) => (
        <Tooltip title={getDREAccountName(v)}>
          <Text style={{ fontSize: 13 }}>{getDREAccountName(v)}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Descrição',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: 'Fornecedor',
      dataIndex: 'supplier',
      width: 150,
      ellipsis: true,
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Valor',
      dataIndex: 'amountReais',
      width: 120,
      align: 'right',
      render: (v: number) => (
        <Text strong>{formatBRL(v)}</Text>
      ),
      sorter: (a, b) => a.amountReais - b.amountReais,
    },
    {
      title: 'Vencimento',
      dataIndex: 'dueDate',
      width: 100,
      render: (v: string | null) => formatDateBR(v),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (v: ExpenseStatus) => (
        <Tag color={STATUS_COLORS[v]}>{EXPENSE_STATUS_LABELS[v]}</Tag>
      ),
    },
    {
      title: 'Comprov.',
      key: 'receipt',
      width: 70,
      align: 'center',
      render: (_, record) =>
        record.receiptUrl ? (
          <Tooltip title={record.receiptFileName}>
            <Button
              type="link"
              icon={<EyeOutlined />}
              href={record.receiptUrl}
              target="_blank"
              size="small"
            />
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Recorr.',
      key: 'recurring',
      width: 60,
      align: 'center',
      render: (_, record) =>
        record.isRecurring ? (
          <Tooltip
            title={
              record.recurringMonths
                ? `${record.recurringMonths} meses`
                : 'Indefinido'
            }
          >
            <SyncOutlined style={{ color: '#1890ff' }} />
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size={0}>
          {record.status === 'PENDING' && (
            <Tooltip title="Registrar pagamento">
              <Button
                type="text"
                icon={<WalletOutlined style={{ color: '#52c41a' }} />}
                size="small"
                onClick={() => markPaidMutation.mutate(record.id)}
                loading={markPaidMutation.isPending}
              />
            </Tooltip>
          )}
          <Tooltip title="Editar">
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleOpenEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Remover despesa?"
            description="Esta ação não pode ser desfeita."
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="Remover"
            cancelText="Cancelar"
          >
            <Tooltip title="Remover">
              <Button type="text" icon={<DeleteOutlined />} size="small" danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Opções para filtro de conta DRE
  const dreFilterOptions = useMemo(() => {
    const groups = DRE_CHART_OF_ACCOUNTS.filter(
      (acc) => acc.level === 1 && acc.type === 'group' && !acc.isTotal && acc.code.match(/^[2-9]\./)
    );
    return [
      { label: 'Todas contas', value: 'all' },
      ...groups.map((g) => ({ label: `${g.code} ${g.name}`, value: g.code })),
    ];
  }, []);

  // Filters render
  const renderFilters = () => (
    <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
      <Space wrap size="middle">
        <Space size={4}>
          <CalendarOutlined style={{ color: '#8c8c8c' }} />
          <Select
            value={periodPreset}
            onChange={(v) => {
              setPeriodPreset(v);
              if (v !== 'custom') setCustomRange(null);
            }}
            style={{ width: 150 }}
            options={[
              { label: 'Hoje', value: 'today' },
              { label: 'Últimos 7 dias', value: '7d' },
              { label: 'Últimos 30 dias', value: '30d' },
              { label: 'Mês atual', value: 'month' },
              { label: 'Mês anterior', value: 'lastMonth' },
              { label: 'Personalizado', value: 'custom' },
            ]}
          />
        </Space>
        {periodPreset === 'custom' && (
          <RangePicker
            value={customRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setCustomRange([dates[0], dates[1]]);
              }
            }}
            format="DD/MM/YYYY"
          />
        )}
        <Select
          value={dreAccountFilter}
          onChange={setDreAccountFilter}
          style={{ width: 220 }}
          options={dreFilterOptions}
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 130 }}
          options={[
            { label: 'Todos status', value: 'all' },
            { label: 'Pendente', value: 'PENDING' },
            { label: 'Pago', value: 'PAID' },
            { label: 'Cancelado', value: 'CANCELED' },
          ]}
        />
        <ELInput.Search
          placeholder="Buscar..."
          allowClear
          onSearch={setSearchQuery}
        />
      </Space>

      <Space>
        <Button icon={<DownloadOutlined />} onClick={handleExportCSV} disabled={!data?.items?.length}>
          Exportar CSV
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
          Nova Despesa
        </Button>
      </Space>
    </Flex>
  );

  if (!hasValidPeriod) {
    return (
      <Flex vertical gap={24}>
        {renderFilters()}
        <Empty description="Selecione um período para visualizar as despesas" />
      </Flex>
    );
  }

  if (isLoading) {
    return (
      <Flex vertical gap={24}>
        {renderFilters()}
        <Flex vertical justify="center" align="center" gap={12} style={{ minHeight: 300 }}>
          <Spin size="large" />
          <span style={{ color: '#666' }}>Carregando despesas...</span>
        </Flex>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex vertical gap={24}>
        {renderFilters()}
        <Empty
          description={
            <Space orientation="vertical">
              <Text>Erro ao carregar despesas</Text>
              <Text type="secondary">
                {error instanceof Error ? error.message : 'Erro desconhecido'}
              </Text>
            </Space>
          }
        />
      </Flex>
    );
  }

  const summary = data?.summary;
  const pendingAmount = summary?.byStatus?.PENDING?.amountReais || 0;
  const paidAmount = summary?.byStatus?.PAID?.amountReais || 0;

  return (
    <Flex vertical gap={24}>
      {renderFilters()}

      {/* Resumo */}
      <Card size="small">
        <Row gutter={[24, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title="Total de Despesas"
              value={summary?.totalCount || 0}
              prefix={<FileTextOutlined />}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title="Valor Total"
              value={summary?.totalAmountReais || 0}
              precision={2}
              prefix={<DollarOutlined />}
              styles={{ content: { color: '#1890ff' } }}
              formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title="Pendentes"
              value={pendingAmount}
              precision={2}
              prefix={<ClockCircleOutlined />}
              styles={{ content: { color: '#fa8c16' } }}
              formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title="Pagas"
              value={paidAmount}
              precision={2}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { color: '#52c41a' } }}
              formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
          </Col>
        </Row>
      </Card>

      {/* Tabela */}
      <Table<Expense>
        rowKey="id"
        dataSource={data?.items || []}
        columns={columns}
        pagination={{
          current: page,
          pageSize,
          total: data?.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `${total} despesas`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
        scroll={{ x: 1200, y: 'calc(100vh - 480px)' }}
        size="middle"
      />

      {/* Modal Create/Edit */}
      <ELModal
        title={editingExpense ? 'Editar Despesa' : 'Nova Despesa'}
        open={isModalOpen}
        onCancel={handleCloseModal}
        footer={null}
        size="lg"
        destroyOnHidden
      >
        <Form<ExpenseFormValues>
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="dreAccountCode"
            label="Conta de Despesa (DRE)"
            rules={[{ required: true, message: 'Selecione a conta de despesa' }]}
          >
            <TreeSelect
              showSearch
              style={{ width: '100%' }}
              dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
              placeholder="Selecione a conta de despesa"
              treeData={DRE_ACCOUNT_TREE}
              treeDefaultExpandAll
              filterTreeNode={(input, node) =>
                String(node.title).toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="Descrição"
            rules={[{ required: true, message: 'Informe a descrição' }]}
          >
            <Input placeholder="Descrição da despesa" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="amountReais"
                label="Valor (R$)"
                rules={[{ required: true, message: 'Informe o valor' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  decimalSeparator=","
                  prefix="R$"
                  formatter={inputNumberFormatterBRL}
                  parser={inputNumberParserBRL}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Status">
                <Select
                  options={Object.entries(EXPENSE_STATUS_LABELS).map(([k, v]) => ({
                    label: v,
                    value: k,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="dueDate" label="Vencimento">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="supplier" label="Fornecedor">
                <Input placeholder="Ex: Amazon Web Services" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="reference" label="Referência / NF">
                <Input placeholder="Ex: NF 12345" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="isRecurring" label="Recorrente" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                noStyle
                shouldUpdate={(prev, curr) => prev.isRecurring !== curr.isRecurring}
              >
                {({ getFieldValue }) =>
                  getFieldValue('isRecurring') && (
                    <Form.Item name="recurringMonths" label="Meses">
                      <InputNumber
                        style={{ width: '100%' }}
                        min={1}
                        placeholder="Indefinido"
                      />
                    </Form.Item>
                  )
                }
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                noStyle
                shouldUpdate={(prev, curr) => prev.status !== curr.status}
              >
                {({ getFieldValue }) =>
                  getFieldValue('status') === 'PAID' && (
                    <Form.Item name="paidAt" label="Data Pagamento">
                      <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                    </Form.Item>
                  )
                }
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Observações">
            <TextArea rows={2} placeholder="Observações adicionais..." />
          </Form.Item>

          <Form.Item label="Comprovante (PDF, JPG, PNG)">
            {editingExpense?.receiptUrl && !removeReceipt && (
              <Space style={{ marginBottom: 8 }}>
                <a href={editingExpense.receiptUrl} target="_blank" rel="noreferrer">
                  {editingExpense.receiptFileName}
                </a>
                <Button
                  type="link"
                  danger
                  size="small"
                  onClick={() => setRemoveReceipt(true)}
                >
                  Remover
                </Button>
              </Space>
            )}
            <Upload
              beforeUpload={(file) => {
                setReceiptFile(file);
                return false;
              }}
              onRemove={() => setReceiptFile(null)}
              fileList={receiptFile ? [{ uid: '1', name: receiptFile.name }] : []}
              maxCount={1}
              accept=".pdf,.jpg,.jpeg,.png"
            >
              <Button icon={<UploadOutlined />}>Selecionar arquivo</Button>
            </Upload>
          </Form.Item>

          <Flex justify="end" gap={8}>
            <Button onClick={handleCloseModal}>Cancelar</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editingExpense ? 'Salvar' : 'Criar'}
            </Button>
          </Flex>
        </Form>
      </ELModal>
    </Flex>
  );
}
