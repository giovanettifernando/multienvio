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
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  fetchDREData,
  MONTH_NAMES_SHORT,
  formatCurrency,
  DRE_CHART_OF_ACCOUNTS,
  type DREAccount,
  type DREResponse,
} from '@/lib/admin/finance/dre';

const { Text } = Typography;

interface DRETableRow extends DREAccount {
  key: string;
  [month: string]: string | number | boolean | undefined;
}

export function DRETable() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [year, setYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(currentMonth);

  // Query para buscar dados do DRE
  const { data, isLoading, error, refetch } = useQuery<DREResponse>({
    queryKey: ['admin', 'finance', 'dre', year, startMonth, endMonth],
    queryFn: () => fetchDREData({ year, startMonth, endMonth }),
  });

  // Gerar opções de anos (últimos 5 anos)
  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = currentYear; y >= currentYear - 4; y--) {
      years.push({ label: y.toString(), value: y });
    }
    return years;
  }, [currentYear]);

  // Gerar opções de meses
  const monthOptions = useMemo(() => {
    return MONTH_NAMES_SHORT.map((name, idx) => ({
      label: name,
      value: idx + 1,
    }));
  }, []);

  // Montar dados da tabela
  const tableData = useMemo<DRETableRow[]>(() => {
    if (!data?.months) return [];

    return DRE_CHART_OF_ACCOUNTS.map((account) => {
      const row: DRETableRow = {
        key: account.code,
        ...account,
      };

      // Adicionar valores de cada mês
      for (const monthData of data.months) {
        const monthKey = `m${monthData.month}`;
        row[monthKey] = monthData.values[account.code] || 0;
      }

      // Calcular total
      let total = 0;
      for (const monthData of data.months) {
        total += monthData.values[account.code] || 0;
      }
      row['total'] = total;

      return row;
    });
  }, [data]);

  // Colunas da tabela
  const columns = useMemo<ColumnsType<DRETableRow>>(() => {
    const cols: ColumnsType<DRETableRow> = [
      {
        title: 'Cód.',
        dataIndex: 'code',
        key: 'code',
        width: 60,
        fixed: 'left',
        render: (code: string, record) => (
          <span
            style={{
              fontWeight: record.isBold ? 600 : 400,
              color: record.isTotal ? '#1890ff' : undefined,
              fontSize: 11,
            }}
          >
            {code}
          </span>
        ),
      },
      {
        title: 'Descrição',
        dataIndex: 'name',
        key: 'name',
        width: 240,
        fixed: 'left',
        render: (name: string, record) => (
          <span
            style={{
              fontWeight: record.isBold ? 600 : 400,
              color: record.isTotal ? '#1890ff' : undefined,
              paddingLeft: record.level === 2 ? 8 : record.level === 3 ? 16 : 0,
              fontSize: 11,
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </span>
        ),
      },
    ];

    // Adicionar colunas de meses
    if (data?.months) {
      for (const monthData of data.months) {
        const monthKey = `m${monthData.month}`;
        cols.push({
          title: MONTH_NAMES_SHORT[monthData.month - 1],
          dataIndex: monthKey,
          key: monthKey,
          width: 85,
          align: 'right',
          render: (value: number, record) => {
            const isNegative = value < 0;
            const formatted = formatCurrency(Math.abs(value));
            return (
              <span
                style={{
                  fontWeight: record.isBold ? 600 : 400,
                  color: record.isTotal
                    ? isNegative ? '#f5222d' : '#52c41a'
                    : isNegative ? '#f5222d' : undefined,
                  fontSize: 11,
                }}
              >
                {isNegative ? `(${formatted})` : value === 0 ? '-' : formatted}
              </span>
            );
          },
        });
      }
    }

    // Coluna de total
    cols.push({
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 100,
      fixed: 'right',
      align: 'right',
      render: (value: number, record) => {
        const isNegative = value < 0;
        const formatted = formatCurrency(Math.abs(value));
        return (
          <span
            style={{
              fontWeight: 600,
              color: record.isTotal
                ? isNegative ? '#f5222d' : '#52c41a'
                : isNegative ? '#f5222d' : undefined,
              fontSize: 11,
            }}
          >
            {isNegative ? `(${formatted})` : value === 0 ? '-' : formatted}
          </span>
        );
      },
    });

    return cols;
  }, [data]);

  // Exportar para CSV
  const handleExportCSV = () => {
    if (!data?.months || !tableData.length) return;

    const rows: string[] = [];

    // Cabeçalho
    const header = ['Código', 'Descrição'];
    for (const monthData of data.months) {
      header.push(MONTH_NAMES_SHORT[monthData.month - 1]);
    }
    header.push('Total');
    rows.push(header.join(';'));

    // Dados
    for (const row of tableData) {
      const rowData = [row.code, `"${row.name}"`];
      for (const monthData of data.months) {
        const value = (row[`m${monthData.month}`] as number) || 0;
        rowData.push((value / 100).toFixed(2).replace('.', ','));
      }
      rowData.push(((row['total'] as number) / 100).toFixed(2).replace('.', ','));
      rows.push(rowData.join(';'));
    }

    const csvContent = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dre-${year}-${startMonth}-${endMonth}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Renderizar filtros
  const renderFilters = () => (
    <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
      <Space wrap size="middle">
        <Space size={4}>
          <Text type="secondary">Ano:</Text>
          <Select
            value={year}
            onChange={setYear}
            options={yearOptions}
            style={{ width: 100 }}
          />
        </Space>
        <Space size={4}>
          <Text type="secondary">Mês Inicial:</Text>
          <Select
            value={startMonth}
            onChange={(v) => {
              setStartMonth(v);
              if (v > endMonth) setEndMonth(v);
            }}
            options={monthOptions}
            style={{ width: 100 }}
          />
        </Space>
        <Space size={4}>
          <Text type="secondary">Mês Final:</Text>
          <Select
            value={endMonth}
            onChange={(v) => {
              if (v >= startMonth) setEndMonth(v);
            }}
            options={monthOptions.filter((m) => m.value >= startMonth)}
            style={{ width: 100 }}
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
          disabled={!data?.months?.length}
        >
          Exportar CSV
        </Button>
      </Space>
    </Flex>
  );

  if (isLoading) {
    return (
      <Flex vertical gap={12}>
        {renderFilters()}
        <Card>
          <Flex vertical justify="center" align="center" gap={12} style={{ minHeight: 300 }}>
            <Spin size="large" />
            <span style={{ color: '#666' }}>Carregando DRE...</span>
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
              <Space orientation="vertical">
                <Text>Erro ao carregar DRE</Text>
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

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table<DRETableRow>
          dataSource={tableData}
          columns={columns}
          pagination={false}
          scroll={{ x: 'max-content', y: 'calc(100vh - 380px)' }}
          size="small"
          className="dre-compact-table"
          rowClassName={(record) => {
            if (record.isTotal) return 'dre-total-row';
            if (record.level === 1) return 'dre-group-row';
            if (record.level === 2) return 'dre-subgroup-row';
            return '';
          }}
          sticky
        />
      </Card>

      <style jsx global>{`
        .dre-compact-table .ant-table-thead > tr > th,
        .dre-compact-table .ant-table-tbody > tr > td {
          padding: 2px 4px !important;
          line-height: 1.3 !important;
        }
        .dre-compact-table .ant-table-thead > tr > th {
          font-size: 11px !important;
        }
        .dre-total-row {
          background-color: #e6f7ff !important;
        }
        .dre-total-row:hover > td {
          background-color: #bae7ff !important;
        }
        .dre-group-row {
          background-color: #fafafa !important;
        }
        .dre-group-row:hover > td {
          background-color: #f0f0f0 !important;
        }
        .dre-subgroup-row {
          background-color: #fff !important;
        }
      `}</style>
    </Flex>
  );
}
