'use client';

import { useState } from 'react';
import { Tag, Button, Flex, Input, Select, DatePicker, App } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SearchOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { OpsShipment } from '@/modules/admin/application/ops/types';
import { listShipments } from '@/modules/admin/application/ops/api';
import ShipmentDetailDrawer from './ShipmentDetailDrawer';
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable';
import { formatBRL } from '@/shared/utils/format';

const { RangePicker } = DatePicker;

interface ShipmentsTableProps {
  dateStart?: string;
  dateEnd?: string;
}

// Status mapping for shipments - handles all possible statuses from DB
const getStatusDisplay = (status: string): { label: string; color: string } => {
  const statusMap: Record<string, { label: string; color: string }> = {
    PICKUP_REQUESTED: { label: 'Coleta Solicitada', color: 'orange' },
    AWAITING_DROP_OFF_AT_POINT: { label: 'Aguardando Entrega no Ponto', color: 'orange' },
    RECEIVED_AT_POINT: { label: 'Recebido no Ponto', color: 'blue' },
    IN_TRANSIT_TO_CARRIER: { label: 'Em Trânsito para Transportadora', color: 'cyan' },
    IN_TRANSIT_TO_CARRIER_HUB: { label: 'Em Trânsito para Hub', color: 'cyan' },
    RECEIVED_AT_CARRIER: { label: 'Recebido na Transportadora', color: 'blue' },
    IN_TRANSIT: { label: 'Em Trânsito', color: 'blue' },
    OUT_FOR_DELIVERY: { label: 'Saiu para Entrega', color: 'purple' },
    DELIVERED: { label: 'Entregue', color: 'green' },
    EXCEPTION: { label: 'Exceção', color: 'red' },
    RETURNED: { label: 'Devolvido', color: 'volcano' },
    CANCELED: { label: 'Cancelado', color: 'default' },
  };

  return statusMap[status] || { label: status, color: 'default' };
};

export default function ShipmentsTable({ dateStart, dateEnd }: ShipmentsTableProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [carrierFilter, setCarrierFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Detail drawer
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);

  // Fetch shipments
  const { data, isLoading } = useQuery({
    queryKey: [
      'admin',
      'ops',
      'shipments',
      page,
      pageSize,
      search,
      statusFilter,
      carrierFilter,
      dateRange?.[0]?.toISOString(),
      dateRange?.[1]?.toISOString(),
    ],
    queryFn: () =>
      listShipments({
        page,
        pageSize,
        q: search || undefined,
        status: statusFilter,
        carrier: carrierFilter,
        dateStart: dateRange?.[0]?.startOf('day').toISOString() || dateStart,
        dateEnd: dateRange?.[1]?.endOf('day').toISOString() || dateEnd,
      }),
    placeholderData: (prev) => prev,
  });

  // CSV Export
  const handleExportCSV = () => {
    if (!data?.items || data.items.length === 0) {
      message.warning('Nenhum dado para exportar');
      return;
    }

    const headers = [
      'Tracking Multienvio',
      'Tracking Transportadora',
      'Cliente',
      'Destinatário',
      'Cidade Destino',
      'UF',
      'Transportadora',
      'Serviço',
      'Status',
      'Peso (kg)',
      'Valor Declarado',
      'Frete',
      'Criado em',
      'Atualizado em',
    ];

    const rows = data.items.map((s) => [
      s.platformTrackingCode,
      s.carrierTrackingCode || '',
      s.senderName,
      s.recipientName || '',
      s.destinationCity,
      s.destinationState,
      s.carrier || '',
      s.service || '',
      getStatusDisplay(s.status).label,
      s.weight.toString(),
      s.declaredValue.toString(),
      s.freightCost?.toString() || '',
      dayjs(s.createdAt).format('DD/MM/YYYY HH:mm'),
      dayjs(s.updatedAt).format('DD/MM/YYYY HH:mm'),
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `envios_${dayjs().format('YYYY-MM-DD_HH-mm')}.csv`;
    link.click();

    message.success('CSV exportado');
  };

  const columns: DataTableColumn<OpsShipment>[] = [
    {
      title: 'Criado em',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      render: (date: unknown) => dayjs(date as string).format('DD/MM/YY HH:mm'),
      fixed: 'left',
    },
    {
      title: 'Tracking',
      key: 'tracking',
      width: 180,
      fixed: 'left',
      render: (_: unknown, record: OpsShipment) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 12 }}>
            {record.platformTrackingCode}
          </div>
          {record.carrierTrackingCode && (
            <div style={{ fontSize: 11, color: '#666' }}>
              {record.carrierTrackingCode}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Cliente (Remetente)',
      key: 'sender',
      width: 200,
      render: (_: unknown, record: OpsShipment) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.senderName}</div>
          {record.senderEmail && (
            <div style={{ fontSize: 12, color: '#666' }}>{record.senderEmail}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Destinatário',
      key: 'recipient',
      width: 200,
      render: (_: unknown, record: OpsShipment) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.recipientName || '—'}</div>
          {record.recipientPhone && (
            <div style={{ fontSize: 12, color: '#666' }}>{record.recipientPhone}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Destino',
      key: 'destination',
      width: 180,
      render: (_: unknown, record: OpsShipment) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.destinationCity}</div>
          <div style={{ fontSize: 12, color: '#666' }}>
            {record.destinationState} - CEP {record.destinationCep}
          </div>
        </div>
      ),
    },
    {
      title: 'Transportadora',
      key: 'carrier',
      width: 150,
      render: (_: unknown, record: OpsShipment) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.carrier || '—'}</div>
          {record.service && (
            <div style={{ fontSize: 12, color: '#666' }}>{record.service}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 180,
      render: (status: unknown) => {
        const { label, color } = getStatusDisplay(status as string);
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 100,
      fixed: 'right',
      isActions: true,
      render: (_: unknown, record: OpsShipment) => (
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedShipmentId(record.id);
            setDetailDrawerOpen(true);
          }}
        >
          Detalhes
        </Button>
      ),
    },
  ];

  return (
    <>
      <Flex vertical gap={16}>
        {/* Filters */}
        <Flex gap={8} wrap="wrap">
          <Input
            placeholder="Buscar por tracking, cliente, destinatário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefix={<SearchOutlined />}
            style={{ width: 320 }}
            allowClear
          />
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 200 }}
            allowClear
            options={[
              { value: 'AWAITING_DROP_OFF_AT_POINT', label: 'Aguardando Entrega no Ponto' },
              { value: 'IN_TRANSIT_TO_CARRIER', label: 'Em Trânsito para Transportadora' },
              { value: 'IN_TRANSIT_TO_CARRIER_HUB', label: 'Em Trânsito para Hub' },
              { value: 'RECEIVED_AT_CARRIER', label: 'Recebido na Transportadora' },
              { value: 'IN_TRANSIT', label: 'Em Trânsito' },
              { value: 'OUT_FOR_DELIVERY', label: 'Saiu para Entrega' },
              { value: 'DELIVERED', label: 'Entregue' },
              { value: 'EXCEPTION', label: 'Exceção' },
              { value: 'RETURNED', label: 'Devolvido' },
              { value: 'CANCELED', label: 'Cancelado' },
            ]}
          />
          <Select
            placeholder="Transportadora"
            value={carrierFilter}
            onChange={setCarrierFilter}
            style={{ width: 150 }}
            allowClear
            options={[
              { value: 'Correios', label: 'Correios' },
              { value: 'Jadlog', label: 'Jadlog' },
              { value: 'J&T', label: 'J&T' },
              { value: 'Loggi', label: 'Loggi' },
            ]}
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]]);
              } else {
                setDateRange(null);
              }
            }}
            format="DD/MM/YYYY"
            style={{ width: 240 }}
          />
          <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
            Exportar CSV
          </Button>
        </Flex>

        {/* Table */}
        <DataTable<OpsShipment>
          columns={columns}
          data={data?.items || []}
          rowKey="id"
          loading={isLoading}
          enableMobileCards={false}
          compact
          scrollX={2000}
          scrollY="calc(100vh - 480px)"
          pagination={{
            current: page,
            pageSize,
            total: data?.total || 0,
            onChange: (p) => setPage(p),
            showTotal: (total) => `Total: ${total} envios`,
            showSizeChanger: false,
          }}
        />
      </Flex>

      {/* Detail Drawer */}
      <ShipmentDetailDrawer
        open={detailDrawerOpen}
        shipmentId={selectedShipmentId}
        onClose={() => {
          setDetailDrawerOpen(false);
          setSelectedShipmentId(null);
        }}
        onUpdate={() => {
          // Invalidate queries to refresh the list
          queryClient.invalidateQueries({ queryKey: ['admin', 'ops', 'shipments'] });
        }}
      />
    </>
  );
}
