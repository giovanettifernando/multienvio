'use client';

import { useState } from 'react';
import { Table, Flex, Input, Select } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { SearchOutlined } from '@ant-design/icons';
import type { PointOfCollection } from '@/lib/admin/ops/types';
import { listPoC } from '@/lib/admin/ops/api';
import { formatBRL } from '@/lib/utils/format';

export default function PoCTable() {
  // Filters
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>();
  const [cityFilter, setCityFilter] = useState('');

  // Fetch PoCs
  const { data: pocs, isLoading } = useQuery({
    queryKey: ['admin', 'ops', 'pocs'],
    queryFn: () => listPoC({ page: 1, pageSize: 100 }),
  });

  // Filtered PoCs
  const filteredPoCs = pocs?.filter((poc) => {
    if (activeFilter !== undefined && poc.active !== activeFilter) return false;
    if (cityFilter && !poc.city.toLowerCase().includes(cityFilter.toLowerCase())) return false;
    if (
      search &&
      !poc.name.toLowerCase().includes(search.toLowerCase()) &&
      !poc.code.toLowerCase().includes(search.toLowerCase()) &&
      !poc.address.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const columns = [
    {
      title: 'Nome/Código',
      key: 'name',
      width: 200,
      render: (_: unknown, record: PointOfCollection) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.name}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{record.code}</div>
        </div>
      ),
    },
    {
      title: 'Endereço',
      dataIndex: 'address',
      key: 'address',
      width: 280,
    },
    {
      title: 'Cidade/UF',
      key: 'location',
      width: 150,
      render: (_: unknown, record: PointOfCollection) => `${record.city}/${record.state}`,
    },
    {
      title: 'Comissão/Item',
      dataIndex: 'commissionPerItem',
      key: 'commissionPerItem',
      width: 120,
      render: (value: number) => `R$ ${value.toFixed(2)}`,
    },
    {
      title: 'Capacidade Diária',
      dataIndex: 'capacityDaily',
      key: 'capacityDaily',
      width: 140,
      render: (value: number | null) => (value !== null ? value : '—'),
    },
    {
      title: 'Fila Atual',
      dataIndex: 'itemsAwaiting',
      key: 'itemsAwaiting',
      width: 100,
      render: (value: number) => value,
    },
    {
      title: 'Recebidos Hoje',
      dataIndex: 'itemsReceivedToday',
      key: 'itemsReceivedToday',
      width: 130,
      render: (value: number) => value,
    },
    {
      title: 'Comissão acumulada (mês)',
      key: 'monthlyCommission',
      width: 180,
      align: 'right' as const,
      render: (_: unknown, record: PointOfCollection) => {
        const monthlyCommission = (record.monthlyReceived ?? 0) * (record.commissionPerItem ?? 0);
        return formatBRL(monthlyCommission);
      },
    },
  ];

  return (
    <Flex vertical gap={16}>
      {/* Filters */}
      <Flex gap={8} wrap="wrap">
        <Input
          placeholder="Buscar PoC..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          prefix={<SearchOutlined />}
          style={{ width: 240 }}
          allowClear
        />
        <Select
          placeholder="Status"
          value={activeFilter}
          onChange={setActiveFilter}
          style={{ width: 120 }}
          allowClear
          options={[
            { value: true, label: 'Ativo' },
            { value: false, label: 'Inativo' },
          ]}
        />
        <Input
          placeholder="Cidade/UF"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          style={{ width: 160 }}
          allowClear
        />
      </Flex>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={filteredPoCs || []}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 1400, y: 'calc(100vh - 340px)' }}
        pagination={{
          pageSize: 20,
          showTotal: (total) => `Total: ${total} PoCs`,
          showSizeChanger: false,
        }}
        size="small"
      />
    </Flex>
  );
}
