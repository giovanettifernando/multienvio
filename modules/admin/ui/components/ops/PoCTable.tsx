'use client';

import { useState } from 'react';
import { Flex, Select } from 'antd';
import { ELInput } from '@/shared/ui';
const Input = ELInput;
import { useQuery } from '@tanstack/react-query';
import { SearchOutlined } from '@ant-design/icons';
import type { PointOfCollection } from '@/modules/admin/application/ops/types';
import { listPoC } from '@/modules/admin/application/ops/api';
import { formatBRL } from '@/shared/utils/format';
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable';

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

  const columns: DataTableColumn<PointOfCollection>[] = [
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
      render: (value: unknown) => `R$ ${(value as number).toFixed(2)}`,
    },
    {
      title: 'Capacidade Diária',
      dataIndex: 'capacityDaily',
      key: 'capacityDaily',
      width: 140,
      render: (value: unknown) => {
        const v = value as number | null;
        return v !== null ? String(v) : '—';
      },
    },
    {
      title: 'Fila Atual',
      dataIndex: 'itemsAwaiting',
      key: 'itemsAwaiting',
      width: 100,
      render: (value: unknown) => String(value as number),
    },
    {
      title: 'Recebidos Hoje',
      dataIndex: 'itemsReceivedToday',
      key: 'itemsReceivedToday',
      width: 130,
      render: (value: unknown) => String(value as number),
    },
    {
      title: 'Comissão acumulada (mês)',
      key: 'monthlyCommission',
      width: 180,
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
      <DataTable<PointOfCollection>
        columns={columns}
        data={filteredPoCs || []}
        rowKey="id"
        loading={isLoading}
        enableMobileCards={false}
        compact
        scrollX={1400}
        scrollY="calc(100vh - 340px)"
        pagination={{
          pageSize: 20,
          showTotal: (total) => `Total: ${total} PoCs`,
          showSizeChanger: false,
        }}
      />
    </Flex>
  );
}
