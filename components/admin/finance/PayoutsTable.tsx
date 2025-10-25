'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  Flex,
  Select,
  Button,
  Tag,
  Modal,
  Form,
  Input,
  App,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { CheckOutlined, LinkOutlined } from '@ant-design/icons';
import type { CarrierPayout, PayoutStatus, PeriodFilter, Paged } from '@/lib/admin/finance/types';
import { listPayouts, markPayoutPaid } from '@/lib/admin/finance/api';

interface PayoutsTableProps {
  period: PeriodFilter;
}

const statusColors: Record<PayoutStatus, string> = {
  pending: 'processing',
  paid: 'success',
  failed: 'error',
};

const statusLabels: Record<PayoutStatus, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  failed: 'Falhou',
};

export function PayoutsTable({ period }: PayoutsTableProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [carrier, setCarrier] = useState<string | 'all'>('all');
  const [status, setStatus] = useState<PayoutStatus | 'all'>('all');
  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<CarrierPayout | null>(null);
  const [markPaidForm] = Form.useForm();

  const params = useMemo(
    () => ({
      page,
      pageSize,
      carrier: carrier === 'all' ? undefined : carrier,
      status: status === 'all' ? undefined : status,
      ...period,
    }),
    [page, pageSize, carrier, status, period]
  );

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'finance', 'payouts', params],
    queryFn: () => listPayouts(params),
    placeholderData: keepPreviousData,
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ id, reference, proofUrl }: { id: string; reference?: string; proofUrl?: string }) =>
      markPayoutPaid(id, reference, proofUrl),
    onMutate: async ({ id, reference, proofUrl }) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'finance', 'payouts'] });
      queryClient.setQueriesData({ queryKey: ['admin', 'finance', 'payouts'] }, (old: Paged<CarrierPayout> | undefined) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((p: CarrierPayout) =>
            p.id === id
              ? { ...p, status: 'paid' as PayoutStatus, reference: reference || p.reference, proofUrl: proofUrl || p.proofUrl }
              : p
          ),
        };
      });
    },
    onSuccess: () => {
      message.success('Repasse marcado como pago');
      setMarkPaidModalOpen(false);
      setSelectedPayout(null);
      markPaidForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'payouts'] });
    },
    onError: () => {
      message.error('Falha ao marcar repasse como pago');
      queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'payouts'] });
    },
  });

  const handleMarkPaid = () => {
    if (!selectedPayout) return;
    const values = markPaidForm.getFieldsValue();
    markPaidMutation.mutate({
      id: selectedPayout.id,
      reference: values.reference,
      proofUrl: values.proofUrl,
    });
  };

  const openMarkPaidModal = (payout: CarrierPayout) => {
    setSelectedPayout(payout);
    markPaidForm.setFieldsValue({
      reference: payout.reference || '',
      proofUrl: payout.proofUrl || '',
    });
    setMarkPaidModalOpen(true);
  };

  const columns: ColumnsType<CarrierPayout> = [
    {
      title: 'Período',
      key: 'period',
      width: 200,
      render: (_, record) =>
        `${dayjs(record.periodStart).format('DD/MM/YYYY')} - ${dayjs(record.periodEnd).format('DD/MM/YYYY')}`,
    },
    {
      title: 'Transportadora',
      dataIndex: 'carrier',
      width: 150,
    },
    {
      title: 'Valor',
      dataIndex: 'amount',
      width: 130,
      align: 'right',
      render: (v: number) =>
        v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      sorter: (a, b) => a.amount - b.amount,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (v: PayoutStatus) => <Tag color={statusColors[v]}>{statusLabels[v]}</Tag>,
    },
    {
      title: 'Referência',
      dataIndex: 'reference',
      width: 150,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Comprovante',
      dataIndex: 'proofUrl',
      width: 120,
      render: (v: string | null) =>
        v ? (
          <Button
            type="link"
            size="small"
            icon={<LinkOutlined />}
            href={v}
            target="_blank"
          >
            Ver
          </Button>
        ) : (
          '—'
        ),
    },
    {
      title: 'Ações',
      key: 'actions',
      fixed: 'right',
      width: 130,
      render: (_, record) =>
        record.status === 'pending' ? (
          <Button
            type="link"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => openMarkPaidModal(record)}
          >
            Marcar Pago
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <Flex vertical gap={16}>
        <Flex gap={8} wrap="wrap">
          <Select
            value={carrier}
            onChange={(v) => {
              setPage(1);
              setCarrier(v);
            }}
            style={{ width: 180 }}
            options={[
              { label: 'Todas transportadoras', value: 'all' },
              { label: 'Correios', value: 'Correios' },
              { label: 'Jadlog', value: 'Jadlog' },
              { label: 'Loggi', value: 'Loggi' },
            ]}
          />
          <Select
            value={status}
            onChange={(v) => {
              setPage(1);
              setStatus(v);
            }}
            style={{ width: 150 }}
            options={[
              { label: 'Todos', value: 'all' },
              { label: 'Pendente', value: 'pending' },
              { label: 'Pago', value: 'paid' },
              { label: 'Falhou', value: 'failed' },
            ]}
          />
        </Flex>

        <Table<CarrierPayout>
          rowKey="id"
          dataSource={data?.items ?? []}
          columns={columns}
          loading={isLoading}
          pagination={{
            current: page,
            pageSize,
            total: data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (total) => `Total: ${total}`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          scroll={{ x: 1100 }}
        />
      </Flex>

      <Modal
        title="Marcar Repasse como Pago"
        open={markPaidModalOpen}
        onOk={handleMarkPaid}
        onCancel={() => {
          setMarkPaidModalOpen(false);
          setSelectedPayout(null);
          markPaidForm.resetFields();
        }}
        confirmLoading={markPaidMutation.isPending}
      >
        <Form form={markPaidForm} layout="vertical">
          <Form.Item name="reference" label="Referência (opcional)">
            <Input placeholder="Ex: REM-2025-001" />
          </Form.Item>
          <Form.Item name="proofUrl" label="URL Comprovante (opcional)">
            <Input placeholder="https://exemplo.com/comprovante.pdf" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
