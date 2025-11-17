'use client';

import { useState } from 'react';
import { Card, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import SearchFilters from '@/components/collectors/SearchFilters';
import CollectorsTable from '@/components/collectors/CollectorsTable';
import CollectorDrawer from '@/components/collectors/CollectorDrawer';
import {
  useCollectors,
  useCreateCollector,
  useUpdateCollector,
  useDeleteCollector,
  useToggleCollectorStatus,
} from '@/lib/collectors/hooks';
import type { Collector, CollectorFilters, CollectorFormData } from '@/lib/collectors/types';
import { PageShell } from '@/components/shared/PageShell';

export default function ColetoresPage() {
  const [filters, setFilters] = useState<CollectorFilters>({
    status: 'all',
    page: 1,
    pageSize: 10,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCollector, setEditingCollector] = useState<Collector | null>(null);

  const { data, isLoading } = useCollectors(filters);
  const createCollector = useCreateCollector();
  const updateCollector = useUpdateCollector();
  const deleteCollector = useDeleteCollector();
  const toggleStatus = useToggleCollectorStatus();

  const handleFiltersChange = (next: CollectorFilters) => {
    setFilters({ ...next, pageSize: filters.pageSize });
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setFilters({ ...filters, page, pageSize });
  };

  const handleAdd = () => {
    setEditingCollector(null);
    setDrawerOpen(true);
  };

  const handleEdit = (collector: Collector) => {
    setEditingCollector(collector);
    setDrawerOpen(true);
  };

  const handleClose = () => {
    setDrawerOpen(false);
    setEditingCollector(null);
  };

  const handleSubmit = async (payload: CollectorFormData) => {
    if (editingCollector) {
      await updateCollector.mutateAsync(
        { id: editingCollector.id, data: payload },
        {
          onSuccess: () => {
            handleClose();
          },
        }
      );
    } else {
      await createCollector.mutateAsync(payload, {
        onSuccess: () => {
          handleClose();
        },
      });
    }
  };

  const handleDelete = async (id: string) => {
    await deleteCollector.mutateAsync(id);
  };

  const handleToggleStatus = async (id: string, status: 'active' | 'blocked') => {
    await toggleStatus.mutateAsync({ id, status });
  };

  return (
    <PageShell
      title="Coletores"
      gap="md"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Adicionar Coletor
        </Button>
      }
    >
      <Card>
        <SearchFilters onChange={handleFiltersChange} />
        <CollectorsTable
          data={data}
          loading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
          onPageChange={handlePageChange}
        />
      </Card>

      <CollectorDrawer
        open={drawerOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        loading={createCollector.isPending || updateCollector.isPending}
        editCollector={editingCollector}
      />
    </PageShell>
  );
}
