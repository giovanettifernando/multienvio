'use client';

import { useState } from 'react';
import { Table, Tag, Button, Flex, Input, Select, DatePicker, Checkbox, Drawer, Timeline, Space, message, Modal } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SearchOutlined, ReloadOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { OpsShipment, ShipmentStatus, PickupType, CarrierCode, TimelineEvent } from '@/lib/admin/ops/types';
import { listShipments, bulkUpdateShipmentStatus, reprocessShipment, getShipmentTimeline } from '@/lib/admin/ops/api';

const { RangePicker } = DatePicker;

interface ShipmentsTableProps {
  dateStart?: string;
  dateEnd?: string;
}

const statusColors: Record<ShipmentStatus, string> = {
  awaiting_dropoff: 'orange',
  awaiting_pickup: 'orange',
  received_at_poc: 'blue',
  in_pickup: 'cyan',
  in_transit: 'blue',
  exception: 'red',
  out_for_delivery: 'purple',
  delivered: 'green',
  returned: 'volcano',
};

const statusLabels: Record<ShipmentStatus, string> = {
  awaiting_dropoff: 'Aguardando Entrega',
  awaiting_pickup: 'Aguardando Coleta',
  received_at_poc: 'Recebido no PoC',
  in_pickup: 'Em Coleta',
  in_transit: 'Em Trânsito',
  exception: 'Exceção',
  out_for_delivery: 'Saiu p/ Entrega',
  delivered: 'Entregue',
  returned: 'Devolvido',
};

export default function ShipmentsTable({ dateStart, dateEnd }: ShipmentsTableProps) {
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | undefined>();
  const [pickupTypeFilter, setPickupTypeFilter] = useState<PickupType | undefined>();
  const [carrierFilter, setCarrierFilter] = useState<CarrierCode | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [riskOnly, setRiskOnly] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Selection
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  // Timeline drawer
  const [timelineDrawerOpen, setTimelineDrawerOpen] = useState(false);
  const [timelineShipmentId, setTimelineShipmentId] = useState<string | null>(null);

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
      pickupTypeFilter,
      carrierFilter,
      dateRange?.[0]?.toISOString(),
      dateRange?.[1]?.toISOString(),
      riskOnly,
    ],
    queryFn: () =>
      listShipments({
        page,
        pageSize,
        q: search || undefined,
        status: statusFilter,
        pickupType: pickupTypeFilter,
        carrier: carrierFilter,
        dateStart: dateRange?.[0]?.startOf('day').toISOString() || dateStart,
        dateEnd: dateRange?.[1]?.endOf('day').toISOString() || dateEnd,
        riskOnly: riskOnly || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  // Fetch timeline
  const { data: timeline, isLoading: timelineLoading } = useQuery({
    queryKey: ['admin', 'ops', 'shipments', timelineShipmentId, 'timeline'],
    queryFn: () => getShipmentTimeline(timelineShipmentId!),
    enabled: !!timelineShipmentId,
  });

  // Bulk update status
  const handleBulkUpdate = async (status: ShipmentStatus) => {
    if (selectedRowKeys.length === 0) {
      message.warning('Selecione ao menos um envio');
      return;
    }

    Modal.confirm({
      title: 'Atualizar Status',
      content: `Deseja atualizar ${selectedRowKeys.length} envio(s) para "${statusLabels[status]}"?`,
      onOk: async () => {
        try {
          await bulkUpdateShipmentStatus(selectedRowKeys, status);

          // Optimistic update
          queryClient.setQueriesData(
            { queryKey: ['admin', 'ops', 'shipments'] },
            (old: { items: OpsShipment[]; total: number } | undefined) => {
              if (!old?.items) return old;
              return {
                ...old,
                items: old.items.map((s: OpsShipment) =>
                  selectedRowKeys.includes(s.id)
                    ? { ...s, status, updatedAt: new Date().toISOString() }
                    : s
                ),
              };
            }
          );

          message.success('Status atualizado com sucesso');
          setSelectedRowKeys([]);
        } catch {
          message.error('Erro ao atualizar status');
        }
      },
    });
  };

  // Reprocess shipment
  const handleReprocess = async (id: string) => {
    try {
      await reprocessShipment(id);
      message.success('Envio reprocessado');
      queryClient.invalidateQueries({ queryKey: ['admin', 'ops', 'shipments'] });
    } catch {
      message.error('Erro ao reprocessar');
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!data?.items || data.items.length === 0) {
      message.warning('Nenhum dado para exportar');
      return;
    }

    const headers = [
      'ID',
      'Cliente',
      'Pedido',
      'Carrier',
      'Serviço',
      'Status',
      'Tipo Pickup',
      'PoC',
      'Tracking',
      'Criado em',
      'Atualizado em',
      'ETA',
      'Peso (kg)',
      'Risco',
    ];

    const rows = data.items.map((s) => [
      s.id,
      s.customerName,
      s.orderRef || '',
      s.carrier || '',
      s.service || '',
      statusLabels[s.status],
      s.pickupType,
      s.pocName || '',
      s.trackingCode || '',
      dayjs(s.createdAt).format('DD/MM/YYYY HH:mm'),
      dayjs(s.updatedAt).format('DD/MM/YYYY HH:mm'),
      s.eta ? dayjs(s.eta).format('DD/MM/YYYY') : '',
      s.weightKg?.toString() || '',
      s.riskFlag ? 'Sim' : 'Não',
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `envios_${dayjs().format('YYYY-MM-DD_HH-mm')}.csv`;
    link.click();

    message.success('CSV exportado');
  };

  const columns = [
    {
      title: 'Criado em',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (date: string) => dayjs(date).format('DD/MM/YY HH:mm'),
    },
    {
      title: 'Cliente',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 180,
    },
    {
      title: 'Pedido',
      dataIndex: 'orderRef',
      key: 'orderRef',
      width: 140,
      render: (ref: string | null) => ref || '—',
    },
    {
      title: 'Carrier/Serviço',
      key: 'carrier',
      width: 150,
      render: (_: unknown, record: OpsShipment) =>
        record.carrier ? (
          <div>
            <div style={{ fontWeight: 500 }}>{record.carrier}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{record.service || '—'}</div>
          </div>
        ) : (
          '—'
        ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status: ShipmentStatus) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
    },
    {
      title: 'Pickup',
      dataIndex: 'pickupType',
      key: 'pickupType',
      width: 120,
      render: (type: PickupType) => {
        const labels = {
          home_pickup: 'Casa',
          poc_pickup: 'PoC',
          locker_pickup: 'Locker',
        };
        return labels[type];
      },
    },
    {
      title: 'PoC',
      dataIndex: 'pocName',
      key: 'pocName',
      width: 120,
      render: (name: string | null) => name || '—',
    },
    {
      title: 'Tracking',
      dataIndex: 'trackingCode',
      key: 'trackingCode',
      width: 130,
      render: (code: string | null) => (code ? <code style={{ fontSize: 11 }}>{code}</code> : '—'),
    },
    {
      title: 'ETA',
      dataIndex: 'eta',
      key: 'eta',
      width: 100,
      render: (eta: string | null) => (eta ? dayjs(eta).format('DD/MM/YY') : '—'),
    },
    {
      title: 'Atualizado em',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 140,
      render: (date: string) => dayjs(date).format('DD/MM/YY HH:mm'),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_: unknown, record: OpsShipment) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setTimelineShipmentId(record.id);
              setTimelineDrawerOpen(true);
            }}
          >
            Timeline
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => handleReprocess(record.id)}
          >
            Reprocessar
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Flex vertical gap={16}>
        {/* Filters */}
        <Flex gap={8} wrap="wrap">
          <Input
            placeholder="Buscar cliente, pedido, tracking..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefix={<SearchOutlined />}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 160 }}
            allowClear
            options={Object.entries(statusLabels).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <Select
            placeholder="Tipo de Pickup"
            value={pickupTypeFilter}
            onChange={setPickupTypeFilter}
            style={{ width: 140 }}
            allowClear
            options={[
              { value: 'home_pickup', label: 'Casa' },
              { value: 'poc_pickup', label: 'PoC' },
              { value: 'locker_pickup', label: 'Locker' },
            ]}
          />
          <Select
            placeholder="Carrier"
            value={carrierFilter}
            onChange={setCarrierFilter}
            style={{ width: 120 }}
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
          <Checkbox checked={riskOnly} onChange={(e) => setRiskOnly(e.target.checked)}>
            Somente Risco
          </Checkbox>
        </Flex>

        {/* Bulk Actions */}
        {selectedRowKeys.length > 0 && (
          <Flex gap={8} align="center">
            <span style={{ fontWeight: 500 }}>{selectedRowKeys.length} selecionado(s)</span>
            <Select
              placeholder="Atualizar Status"
              style={{ width: 200 }}
              onChange={handleBulkUpdate}
              options={Object.entries(statusLabels).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
              Exportar CSV
            </Button>
          </Flex>
        )}

        {/* Table */}
        <Table
          columns={columns}
          dataSource={data?.items || []}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1600 }}
          pagination={{
            current: page,
            pageSize,
            total: data?.total || 0,
            onChange: setPage,
            showTotal: (total) => `Total: ${total} envios`,
            showSizeChanger: false,
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as string[]),
          }}
          size="small"
        />
      </Flex>

      {/* Timeline Drawer */}
      <Drawer
        title="Timeline do Envio"
        placement="right"
        onClose={() => {
          setTimelineDrawerOpen(false);
          setTimelineShipmentId(null);
        }}
        open={timelineDrawerOpen}
        width={500}
      >
        {timelineLoading ? (
          <div>Carregando...</div>
        ) : timeline && timeline.length > 0 ? (
          <Timeline
            items={timeline.map((evt: TimelineEvent) => ({
              children: (
                <div>
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>{evt.description}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {dayjs(evt.timestamp).format('DD/MM/YYYY HH:mm')}
                  </div>
                  {evt.location && (
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                      Local: {evt.location}
                    </div>
                  )}
                </div>
              ),
              color: evt.status === 'exception' ? 'red' : evt.status === 'delivered' ? 'green' : 'blue',
            }))}
          />
        ) : (
          <div>Nenhum evento registrado</div>
        )}
      </Drawer>
    </>
  );
}
