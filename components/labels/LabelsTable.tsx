'use client';

import { useMemo, useState } from 'react';
import { Table, Space, Button, Input, Select, Flex, App, Skeleton, Empty, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchLabels } from '@/lib/api/labels';
import type { LabelItem, PrintStatus } from '@/lib/types/label';

export interface LabelsTableProps {
  onOpenLabel: (record: LabelItem) => void;
}

export function LabelsTable({ onOpenLabel }: LabelsTableProps) {
  const { message } = App.useApp();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [printStatus, setPrintStatus] = useState<PrintStatus | 'all'>('all');

  const params = useMemo(() => ({
    page,
    pageSize,
    q,
    printStatus: printStatus !== 'all' ? printStatus : undefined,
  }), [page, pageSize, q, printStatus]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['labels', params],
    queryFn: () => fetchLabels(params),
    placeholderData: keepPreviousData,
  });

  const columns: ColumnsType<LabelItem> = [
    {
      title: 'Código do envio',
      dataIndex: 'trackingCode',
      width: 180,
      render: (trackingCode: string | null | undefined) => trackingCode || '-',
    },
    {
      title: 'CEP origem',
      dataIndex: 'originCep',
      width: 140,
    },
    {
      title: 'CEP destino',
      dataIndex: 'destinationCep',
      width: 140,
    },
    {
      title: 'Nome destinatário',
      dataIndex: ['recipient', 'name'],
      ellipsis: true,
    },
    {
      title: 'Status de impressão',
      key: 'printStatus',
      width: 180,
      render: (_, record) => (
        record.isPrinted ? (
          <Tag color="success">Já impressa</Tag>
        ) : (
          <Tag color="warning">Falta imprimir</Tag>
        )
      ),
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
          placeholder="Buscar por código do envio..."
          onSearch={(v) => { setPage(1); setQ(v); }}
          style={{ maxWidth: 300 }}
        />
        <Select
          value={printStatus}
          onChange={(v) => { setPage(1); setPrintStatus(v as PrintStatus | 'all'); }}
          style={{ width: 200 }}
          options={[
            { label: 'Todos os status', value: 'all' },
            { label: 'Faltam imprimir', value: 'not_printed' },
            { label: 'Já impressas', value: 'printed' },
          ]}
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
