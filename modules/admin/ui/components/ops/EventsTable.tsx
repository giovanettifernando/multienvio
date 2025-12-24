'use client';

import { useState } from 'react';
import { Tag, Flex, Space, App } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ReloadOutlined, CheckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { OpsEvent } from '@/modules/admin/application/ops/types';
import { listEvents, retryEvent, markEventProcessed } from '@/modules/admin/application/ops/api';
import { ELButton, ELSelect } from '@/shared/ui';
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable';

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

interface EventsTableProps {
  dateStart?: string;
  dateEnd?: string;
}

export default function EventsTable({ dateStart, dateEnd }: EventsTableProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  // Filters
  const [processedFilter, setProcessedFilter] = useState<string | undefined>();
  const [sourceFilter, setSourceFilter] = useState<OpsEvent['source'] | undefined>();

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Fetch events
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'ops', 'events', page, pageSize, processedFilter, sourceFilter, dateStart, dateEnd],
    queryFn: () =>
      listEvents({
        page,
        pageSize,
        processed: processedFilter === 'true' ? true : processedFilter === 'false' ? false : undefined,
        source: sourceFilter,
        dateStart,
        dateEnd,
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

  const columns: DataTableColumn<OpsEvent>[] = [
    {
      title: 'Recebido em',
      dataIndex: 'receivedAt',
      key: 'receivedAt',
      width: 150,
      render: (date: unknown) => dayjs(date as string).format('DD/MM/YY HH:mm:ss'),
    },
    {
      title: 'Fonte',
      dataIndex: 'source',
      key: 'source',
      width: 150,
      render: (source: unknown) => {
        const s = source as OpsEvent['source'];
        return <Tag color={sourceColors[s]}>{sourceLabels[s]}</Tag>;
      },
    },
    {
      title: 'Envio',
      dataIndex: 'shipmentId',
      key: 'shipmentId',
      width: 120,
      render: (shipmentId: unknown) => {
        const id = shipmentId as string | null;
        return id ? (
          <a href={`#`} style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {id}
          </a>
        ) : (
          '—'
        );
      },
    },
    {
      title: 'Payload Preview',
      dataIndex: 'payloadPreview',
      key: 'payloadPreview',
      width: 300,
      ellipsis: true,
      render: (text: unknown) => (
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#666' }}>{text as string}</span>
      ),
    },
    {
      title: 'Processado',
      dataIndex: 'processed',
      key: 'processed',
      width: 100,
      render: (processed: unknown) => {
        const p = processed as boolean;
        return <Tag color={p ? 'green' : 'orange'}>{p ? 'Sim' : 'Não'}</Tag>;
      },
    },
    {
      title: 'Retries',
      dataIndex: 'retries',
      key: 'retries',
      width: 80,
      render: (retries: unknown) => (retries as number) || 0,
    },
    {
      title: 'Erro',
      dataIndex: 'lastError',
      key: 'lastError',
      width: 200,
      ellipsis: true,
      render: (error: unknown) => {
        const e = error as string | null;
        return e ? (
          <span style={{ color: '#cf1322', fontSize: 12 }}>{e}</span>
        ) : (
          '—'
        );
      },
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 180,
      fixed: 'right',
      isActions: true,
      render: (_: unknown, record: OpsEvent) => (
        <Space size="small">
          {!record.processed && (
            <>
              <ELButton
                variant="link"
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => handleRetry(record.id)}
              >
                Retry
              </ELButton>
              <ELButton
                variant="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleMarkProcessed(record.id)}
              >
                Marcar OK
              </ELButton>
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
        <ELSelect
          placeholder="Status"
          value={processedFilter}
          onChange={setProcessedFilter}
          style={{ width: 140 }}
          allowClear
          options={[
            { value: 'true', label: 'Processado' },
            { value: 'false', label: 'Pendente' },
          ]}
        />
        <ELSelect
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
      <DataTable<OpsEvent>
        columns={columns}
        data={data?.items || []}
        rowKey="id"
        loading={isLoading}
        enableMobileCards={false}
        compact
        scrollX={1400}
        scrollY="calc(100vh - 480px)"
        pagination={{
          current: page,
          pageSize,
          total: data?.total || 0,
          onChange: (p) => setPage(p),
          showTotal: (total) => `Total: ${total} eventos`,
          showSizeChanger: false,
        }}
      />
    </Flex>
  );
}
