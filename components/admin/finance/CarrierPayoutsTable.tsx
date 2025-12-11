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
  Tooltip,
  DatePicker,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  DownloadOutlined,
  TruckOutlined,
  DollarOutlined,
  PercentageOutlined,
  FileTextOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import type {
  PeriodFilter,
  CarrierPayoutSummary,
  CarrierPayoutShipment,
} from '@/lib/admin/finance/types';
import { getCarrierPayouts } from '@/lib/admin/finance/api';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

type PeriodPreset = 'today' | '7d' | '30d' | 'month' | 'lastMonth' | 'custom';

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (dateStr: string | null) =>
  dateStr ? dayjs(dateStr).format('DD/MM/YYYY HH:mm') : '-';

// Colunas da tabela expandida (detalhes dos envios)
const shipmentColumns: ColumnsType<CarrierPayoutShipment> = [
  {
    title: 'Rastreio',
    key: 'tracking',
    width: 180,
    render: (_, record) => (
      <Space orientation="vertical" size={0}>
        <Text strong copyable={{ text: record.platformTrackingCode }}>
          {record.platformTrackingCode}
        </Text>
        {record.carrierTrackingCode && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.carrierTrackingCode}
          </Text>
        )}
      </Space>
    ),
  },
  {
    title: 'Serv.',
    dataIndex: 'service',
    width: 80,
    render: (v: string | null) => v || '-',
  },
  {
    title: 'Destino',
    key: 'destination',
    width: 150,
    render: (_, record) => `${record.destinationCity}/${record.destinationState}`,
  },
  {
    title: 'Valor Bruto',
    dataIndex: 'freightCostReais',
    width: 110,
    align: 'right',
    render: (v: number) => formatCurrency(v),
  },
  {
    title: 'Taxa Plataforma',
    dataIndex: 'platformCommissionCents',
    width: 120,
    align: 'right',
    render: (v: number) => formatCurrency(v / 100),
  },
  {
    title: 'Repasse',
    dataIndex: 'netPayoutReais',
    width: 110,
    align: 'right',
    render: (v: number) => (
      <Text strong style={{ color: '#52c41a' }}>
        {formatCurrency(v)}
      </Text>
    ),
  },
  {
    title: 'Data Etiqueta',
    dataIndex: 'createdAt',
    width: 140,
    render: (v: string) => formatDate(v),
  },
  {
    title: 'Postado',
    dataIndex: 'postedAt',
    width: 140,
    render: (v: string | null) => formatDate(v),
  },
  {
    title: 'Status',
    dataIndex: 'labelStatus',
    width: 90,
    render: (v: string) => {
      const colors: Record<string, string> = {
        paid: 'green',
        issued: 'blue',
        pending: 'gold',
        canceled: 'red',
        error: 'red',
      };
      const labels: Record<string, string> = {
        paid: 'Pago',
        issued: 'Emitido',
        pending: 'Pendente',
        canceled: 'Cancelado',
        error: 'Erro',
      };
      return <Tag color={colors[v] || 'default'}>{labels[v] || v}</Tag>;
    },
  },
];

export function CarrierPayoutsTable() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month');
  const [customRange, setCustomRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState<string | 'all'>('all');
  const [expandedCarriers, setExpandedCarriers] = useState<string[]>([]);

  // Calcular período baseado no preset
  const period = useMemo<PeriodFilter>(() => {
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

  // Validar período antes de fazer a query
  const hasValidPeriod = Boolean(period.dateStart && period.dateEnd);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'finance', 'carrier-payouts', period, selectedCarrier],
    queryFn: () =>
      getCarrierPayouts({
        ...period,
        carrier: selectedCarrier === 'all' ? undefined : selectedCarrier,
      }),
    enabled: hasValidPeriod,
  });

  // Lista de transportadoras disponíveis
  const carrierOptions = useMemo(() => {
    if (!data?.carriers) return [];
    return data.carriers.map((c) => ({
      label: c.carrier,
      value: c.carrier,
    }));
  }, [data?.carriers]);

  // Dados filtrados
  const filteredCarriers = useMemo(() => {
    if (!data?.carriers) return [];
    if (selectedCarrier === 'all') return data.carriers;
    return data.carriers.filter((c) => c.carrier === selectedCarrier);
  }, [data?.carriers, selectedCarrier]);

  // Exportar CSV
  const handleExportCSV = () => {
    if (!data?.carriers) return;

    const rows: string[] = [];

    // Header
    rows.push(
      [
        'Transportadora',
        'Rastreio Plataforma',
        'Rastreio Transportadora',
        'Servico',
        'Destino',
        'Valor Bruto (R$)',
        'Taxa Plataforma (R$)',
        'Valor Repasse (R$)',
        'Data Etiqueta',
        'Data Postagem',
        'Status',
      ].join(';')
    );

    // Data rows
    for (const carrier of filteredCarriers) {
      for (const shipment of carrier.shipments) {
        rows.push(
          [
            carrier.carrier,
            shipment.platformTrackingCode,
            shipment.carrierTrackingCode || '',
            shipment.service || '',
            `${shipment.destinationCity}/${shipment.destinationState}`,
            shipment.freightCostReais.toFixed(2).replace('.', ','),
            (shipment.platformCommissionCents / 100).toFixed(2).replace('.', ','),
            shipment.netPayoutReais.toFixed(2).replace('.', ','),
            shipment.createdAt ? dayjs(shipment.createdAt).format('DD/MM/YYYY HH:mm') : '',
            shipment.postedAt ? dayjs(shipment.postedAt).format('DD/MM/YYYY HH:mm') : '',
            shipment.labelStatus,
          ].join(';')
        );
      }
    }

    const csvContent = '\uFEFF' + rows.join('\n'); // BOM for Excel UTF-8
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const dateStr = dayjs().format('YYYY-MM-DD');
    link.download = `repasses-transportadoras-${dateStr}.csv`;
    link.click();
  };

  // Colunas da tabela principal (por transportadora)
  const carrierColumns: ColumnsType<CarrierPayoutSummary> = [
    {
      title: 'Transportadora',
      dataIndex: 'carrier',
      width: 180,
      render: (v: string) => (
        <Space>
          <TruckOutlined />
          <Text strong>{v}</Text>
        </Space>
      ),
    },
    {
      title: 'Envios',
      dataIndex: 'shipmentCount',
      width: 100,
      align: 'center',
      render: (v: number) => <Tag>{v}</Tag>,
    },
    {
      title: 'Valor Bruto',
      dataIndex: 'grossAmountReais',
      width: 150,
      align: 'right',
      render: (v: number) => formatCurrency(v),
      sorter: (a, b) => a.grossAmountReais - b.grossAmountReais,
    },
    {
      title: 'Taxa Plataforma',
      dataIndex: 'platformCommissionReais',
      width: 150,
      align: 'right',
      render: (v: number) => (
        <Text type="secondary">{formatCurrency(v)}</Text>
      ),
      sorter: (a, b) => a.platformCommissionReais - b.platformCommissionReais,
    },
    {
      title: 'Margem %',
      key: 'margin',
      width: 100,
      align: 'right',
      render: (_, record) => {
        const margin =
          record.grossAmountReais > 0
            ? (record.platformCommissionReais / record.grossAmountReais) * 100
            : 0;
        return (
          <Tooltip title="Taxa da plataforma / Valor bruto">
            <Text type="secondary">{margin.toFixed(1)}%</Text>
          </Tooltip>
        );
      },
    },
    {
      title: 'Valor a Repassar',
      dataIndex: 'netPayoutReais',
      width: 160,
      align: 'right',
      render: (v: number) => (
        <Text strong style={{ color: '#52c41a', fontSize: 15 }}>
          {formatCurrency(v)}
        </Text>
      ),
      sorter: (a, b) => a.netPayoutReais - b.netPayoutReais,
    },
  ];

  // Renderizar filtros sempre visíveis
  const renderFilters = () => (
    <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
      <Space wrap size="middle">
        <Space size={4}>
          <CalendarOutlined style={{ color: '#8c8c8c' }} />
          <Select
            value={periodPreset}
            onChange={(v) => {
              setPeriodPreset(v);
              if (v !== 'custom') {
                setCustomRange(null);
              }
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
          value={selectedCarrier}
          onChange={setSelectedCarrier}
          style={{ width: 200 }}
          options={[
            { label: 'Todas transportadoras', value: 'all' },
            ...carrierOptions,
          ]}
        />
      </Space>

      <Button
        icon={<DownloadOutlined />}
        onClick={handleExportCSV}
        disabled={!data || filteredCarriers.length === 0}
      >
        Exportar CSV
      </Button>
    </Flex>
  );

  if (!hasValidPeriod) {
    return (
      <Flex vertical gap={24}>
        {renderFilters()}
        <Empty description="Selecione um período para visualizar os repasses" />
      </Flex>
    );
  }

  if (isLoading) {
    return (
      <Flex vertical gap={24}>
        {renderFilters()}
        <Flex vertical justify="center" align="center" gap={12} style={{ minHeight: 300 }}>
          <Spin size="large" />
          <span style={{ color: '#666' }}>Calculando repasses...</span>
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
              <Text>Erro ao carregar repasses</Text>
              <Text type="secondary">
                {error instanceof Error ? error.message : 'Erro desconhecido'}
              </Text>
            </Space>
          }
        />
      </Flex>
    );
  }

  if (!data || data.carriers.length === 0) {
    return (
      <Flex vertical gap={24}>
        {renderFilters()}
        <Empty description="Nenhum envio encontrado no período selecionado" />
      </Flex>
    );
  }

  return (
    <Flex vertical gap={24}>
      {/* Filtros */}
      {renderFilters()}

      {/* Resumo Geral */}
      <Card size="small">
        <Row gutter={[24, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title="Total de Envios"
              value={data.summary.totalShipments}
              prefix={<FileTextOutlined />}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title="Valor Bruto"
              value={data.summary.totalGrossReais}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="R$"
              styles={{ content: { color: '#1890ff' } }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title="Taxa Plataforma"
              value={data.summary.totalPlatformCommissionReais}
              precision={2}
              prefix={<PercentageOutlined />}
              suffix="R$"
              styles={{ content: { color: '#fa8c16' } }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title="Total a Repassar"
              value={data.summary.totalNetPayoutReais}
              precision={2}
              prefix={<TruckOutlined />}
              suffix="R$"
              styles={{ content: { color: '#52c41a', fontWeight: 'bold' } }}
            />
          </Col>
        </Row>
      </Card>

      {/* Tabela por Transportadora */}
      <Table<CarrierPayoutSummary>
        rowKey="carrier"
        dataSource={filteredCarriers}
        columns={carrierColumns}
        pagination={false}
        expandable={{
          expandedRowKeys: expandedCarriers,
          onExpandedRowsChange: (keys) => setExpandedCarriers(keys as string[]),
          expandedRowRender: (record) => (
            <div style={{ margin: '8px 0' }}>
              <Title level={5} style={{ marginBottom: 12 }}>
                Detalhamento - {record.carrier} ({record.shipmentCount} envios)
              </Title>
              <Table<CarrierPayoutShipment>
                rowKey="id"
                dataSource={record.shipments}
                columns={shipmentColumns}
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                  showTotal: (total) => `${total} envios`,
                }}
                size="small"
                scroll={{ x: 1200 }}
              />
            </div>
          ),
        }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}>
                <Text strong>TOTAL</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="center">
                <Text strong>{data.summary.totalShipments}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">
                <Text strong>{formatCurrency(data.summary.totalGrossReais)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">
                <Text strong>{formatCurrency(data.summary.totalPlatformCommissionReais)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right">
                {data.summary.totalGrossReais > 0 && (
                  <Text strong>
                    {((data.summary.totalPlatformCommissionReais / data.summary.totalGrossReais) * 100).toFixed(1)}%
                  </Text>
                )}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">
                <Text strong style={{ color: '#52c41a', fontSize: 16 }}>
                  {formatCurrency(data.summary.totalNetPayoutReais)}
                </Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
        scroll={{ x: 900, y: 'calc(100vh - 500px)' }}
      />
    </Flex>
  );
}
