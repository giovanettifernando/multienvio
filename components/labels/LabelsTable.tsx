'use client';

import { useMemo, useState } from 'react';
import { Table, Tag, Space, Button, Input, Select, DatePicker, Flex, Typography, App, Skeleton, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { fetchLabels } from '@/lib/api/labels';
import type { LabelItem, LabelStatus } from '@/lib/types/label';

const { RangePicker } = DatePicker;

export interface LabelsTableProps {
  onOpenLabel: (record: LabelItem) => void;
}

const statusColor: Record<LabelStatus, string> = {
  pending: 'default',
  paid: 'processing',
  issued: 'success',
  canceled: 'error',
  error: 'error',
};

export function LabelsTable({ onOpenLabel }: LabelsTableProps) {
  const { message } = App.useApp();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<LabelStatus | 'all'>('all');
  const [carrier, setCarrier] = useState<string | 'all'>('all');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const params = useMemo(() => ({
    page, pageSize, q, status, carrier,
    dateStart: dateRange ? dateRange[0].startOf('day').toISOString() : undefined,
    dateEnd: dateRange ? dateRange[1].endOf('day').toISOString() : undefined,
  }), [page, pageSize, q, status, carrier, dateRange]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['labels', params],
    queryFn: () => fetchLabels(params),
    placeholderData: keepPreviousData,
  });

  const columns: ColumnsType<LabelItem> = [
    {
      title: 'Criada em',
      dataIndex: 'createdAt',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
      width: 150,
      sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
    },
    { title: 'Etiqueta', dataIndex: 'id', width: 160 },
    { title: 'Envio', dataIndex: 'shipmentId', width: 140 },
    {
      title: 'Destinatário',
      dataIndex: ['recipient', 'name'],
      width: 220,
      ellipsis: true,
    },
    {
      title: 'Transportadora',
      dataIndex: 'carrier',
      width: 160,
      filters: [], // pode ser preenchido depois dinamicamente
    },
    { title: 'Serviço', dataIndex: 'service', width: 200, ellipsis: true },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 130,
      render: (s: LabelStatus) => <Tag color={statusColor[s]}>{s.toUpperCase()}</Tag>,
    },
    {
      title: 'Preço',
      dataIndex: 'price',
      width: 120,
      align: 'right' as const,
      render: (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    },
    {
      title: 'Ações',
      key: 'actions',
      fixed: 'right',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => onOpenLabel(record)}>Visualizar</Button>
        </Space>
      ),
    },
  ];

  return (
    <Flex vertical gap={12}>
      <Flex wrap="wrap" gap={8} align="center">
        <Input.Search
          allowClear
          placeholder="Buscar por etiqueta, envio, destinatário..."
          onSearch={(v) => { setPage(1); setQ(v); }}
          style={{ maxWidth: 360 }}
        />
        <Select
          value={status}
          onChange={(v) => { setPage(1); setStatus(v as LabelStatus | 'all'); }}
          style={{ width: 180 }}
          options={[
            { label: 'Todos os status', value: 'all' },
            { label: 'Pendente', value: 'pending' },
            { label: 'Pago', value: 'paid' },
            { label: 'Emitida', value: 'issued' },
            { label: 'Cancelada', value: 'canceled' },
            { label: 'Erro', value: 'error' },
          ]}
        />
        <Select
          value={carrier}
          onChange={(v) => { setPage(1); setCarrier(v as string | 'all'); }}
          style={{ width: 200 }}
          options={[
            { label: 'Todas as transportadoras', value: 'all' },
            { label: 'Correios', value: 'Correios' },
            { label: 'Jadlog', value: 'Jadlog' },
            { label: 'Loggi', value: 'Loggi' },
            { label: 'J&T Express', value: 'J&T Express' },
          ]}
        />
        <RangePicker
          value={dateRange ?? null}
          onChange={(val) => { setPage(1); setDateRange((val as [dayjs.Dayjs, dayjs.Dayjs] | null) ?? null); }}
        />
      </Flex>

      {isLoading ? (
        <Skeleton active />
      ) : isError ? (
        <Empty description="Falha ao carregar etiquetas" />
      ) : (
        <Table<LabelItem>
          rowKey="id"
          dataSource={data?.items ?? []}
          columns={columns}
          scroll={{ x: 1100 }}
          pagination={{
            current: data?.page ?? page,
            pageSize: data?.pageSize ?? pageSize,
            total: data?.total ?? 0,
            showSizeChanger: true,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          locale={{ emptyText: <Empty description="Nenhuma etiqueta encontrada" /> }}
        />
      )}
    </Flex>
  );
}
