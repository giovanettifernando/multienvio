'use client';

import { useState } from 'react';
import { Table, Tag, Button, Flex, Select, Space, App } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ReloadOutlined, CheckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { OpsEvent } from '@/lib/admin/ops/types';
import { listEvents, retryEvent, markEventProcessed } from '@/lib/admin/ops/api';

const sourceLabels: Record<OpsEvent['source'], string> = {
  carrier_webhook: 'Webhook Carrier',
  poc_checkin: 'Check-in PoC',
  pickup_scan: 'Scan Coleta',
  manual: 'Manual',
};

const sourceColors: Record<OpsEvent['source'], string> = {
  carrier_webhook: 'blue',
  poc_checkin: 'cyan',
  pickup_scan: 'purple',
  manual: 'orange',
};

export default function EventsTable() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  // Filters
  const [processedFilter, setProcessedFilter] = useState<boolean | undefined>();
  const [sourceFilter, setSourceFilter] = useState<OpsEvent['source'] | undefined>();

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Fetch events
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'ops', 'events', page, pageSize, processedFilter, sourceFilter],
    queryFn: () =>
      listEvents({
        page,
        pageSize,
        processed: processedFilter,
        source: sourceFilter,
      }),
    placeholderData: (prev) => prev,
  });

  // Retry event
  const handleRetry = async (id: string) => {
    try {
      await retryEvent(id);

      // Optimistic update
      queryClient.setQueriesData(
        { queryKey: ['admin', 'ops', 'events'] },
        (old: { items: OpsEvent[]; total: number } | undefined) => {
          if (!old?.items) return old;
          return {
            ...old,
            items: old.items.map((e: OpsEvent) =>
              e.id === id
                ? { ...e, retries: (e.retries || 0) + 1, lastError: null }
                : e
            ),
          };
        }
      );

      message.success('Evento reenviado para reprocessamento');
    } catch {
      message.error('Erro ao reprocessar evento');
    }
  };

  // Mark as processed
  const handleMarkProcessed = async (id: string) => {
    try {
      await markEventProcessed(id);

      // Optimistic update
      queryClient.setQueriesData(
        { queryKey: ['admin', 'ops', 'events'] },
        (old: { items: OpsEvent[]; total: number } | undefined) => {
          if (!old?.items) return old;
          return {
            ...old,
            items: old.items.map((e: OpsEvent) =>
              e.id === id ? { ...e, processed: true, lastError: null } : e
            ),
          };
        }
      );

      message.success('Evento marcado como processado');
    } catch {
      message.error('Erro ao marcar evento');
    }
  };

  const columns = [
    {
      title: 'Recebido em',
      dataIndex: 'receivedAt',
      key: 'receivedAt',
      width: 150,
      render: (date: string) => dayjs(date).format('DD/MM/YY HH:mm:ss'),
    },
    {
      title: 'Fonte',
      dataIndex: 'source',
      key: 'source',
      width: 150,
      render: (source: OpsEvent['source']) => (
        <Tag color={sourceColors[source]}>{sourceLabels[source]}</Tag>
      ),
    },
    {
      title: 'Envio',
      dataIndex: 'shipmentId',
      key: 'shipmentId',
      width: 120,
      render: (shipmentId: string | null) =>
        shipmentId ? (
          <a href={`#`} style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {shipmentId}
          </a>
        ) : (
          '—'
        ),
    },
    {
      title: 'Payload Preview',
      dataIndex: 'payloadPreview',
      key: 'payloadPreview',
      width: 300,
      ellipsis: true,
      render: (text: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#666' }}>{text}</span>
      ),
    },
    {
      title: 'Processado',
      dataIndex: 'processed',
      key: 'processed',
      width: 100,
      render: (processed: boolean) => (
        <Tag color={processed ? 'green' : 'orange'}>{processed ? 'Sim' : 'Não'}</Tag>
      ),
    },
    {
      title: 'Retries',
      dataIndex: 'retries',
      key: 'retries',
      width: 80,
      render: (retries: number) => retries || 0,
    },
    {
      title: 'Erro',
      dataIndex: 'lastError',
      key: 'lastError',
      width: 200,
      ellipsis: true,
      render: (error: string | null) =>
        error ? (
          <span style={{ color: '#cf1322', fontSize: 12 }}>{error}</span>
        ) : (
          '—'
        ),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 180,
      fixed: 'right' as const,
      render: (_: unknown, record: OpsEvent) => (
        <Space size="small">
          {!record.processed && (
            <>
              <Button
                type="link"
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => handleRetry(record.id)}
              >
                Retry
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleMarkProcessed(record.id)}
              >
                Marcar OK
              </Button>
            </>
          )}
          {record.processed && <span style={{ color: '#52c41a', fontSize: 12 }}>Processado</span>}
        </Space>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      {/* Filters */}
      <Flex gap={8} wrap="wrap">
        <Select
          placeholder="Status"
          value={processedFilter}
          onChange={setProcessedFilter}
          style={{ width: 140 }}
          allowClear
          options={[
            { value: true, label: 'Processado' },
            { value: false, label: 'Pendente' },
          ]}
        />
        <Select
          placeholder="Fonte"
          value={sourceFilter}
          onChange={setSourceFilter}
          style={{ width: 180 }}
          allowClear
          options={Object.entries(sourceLabels).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </Flex>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={data?.items || []}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 1400, y: 'calc(100vh - 480px)' }}
        pagination={{
          current: page,
          pageSize,
          total: data?.total || 0,
          onChange: setPage,
          showTotal: (total) => `Total: ${total} eventos`,
          showSizeChanger: false,
        }}
        size="small"
      />
    </Flex>
  );
}
