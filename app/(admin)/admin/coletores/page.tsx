'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import EntitySearchFilters from '@/components/shared/EntitySearchFilters';
import CollectorsTable from '@/components/collectors/CollectorsTable';
import CollectorDrawer from '@/components/collectors/CollectorDrawer';
import {
  useCollectors,
  useCreateCollector,
  useDeleteCollector,
  useToggleCollectorStatus,
} from '@/lib/collectors/hooks';
import type { CollectorFilters, CollectorFormData } from '@/lib/collectors/types';
import { PageShell } from '@/components/shared/PageShell';

export default function ColetoresPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<CollectorFilters>({
    status: 'all',
    page: 1,
    pageSize: 10,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, isLoading } = useCollectors(filters);
  const createCollector = useCreateCollector();
  const deleteCollector = useDeleteCollector();
  const toggleStatus = useToggleCollectorStatus();

  const handleFiltersChange = (next: CollectorFilters) => {
    setFilters({ ...next, pageSize: filters.pageSize });
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setFilters({ ...filters, page, pageSize });
  };

  const handleAdd = () => {
    setDrawerOpen(true);
  };

  const handleClose = () => {
    setDrawerOpen(false);
  };

  const handleSubmit = async (payload: CollectorFormData) => {
    await createCollector.mutateAsync(payload, {
      onSuccess: (collector) => {
        handleClose();
        // Navegar para a página de detalhes do novo coletor
        if (collector?.id) {
          router.push(`/admin/coletores/${collector.id}`);
        }
      },
    });
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
        <EntitySearchFilters<CollectorFilters>
          onChange={handleFiltersChange}
          searchPlaceholder="Nome, CNPJ ou placa"
          statusOptions={[
            { label: 'Todos', value: 'all' },
            { label: 'Ativo', value: 'active' },
            { label: 'Bloqueado', value: 'blocked' },
          ]}
        />
        <CollectorsTable
          data={data}
          loading={isLoading}
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
          onPageChange={handlePageChange}
        />
      </Card>

      <CollectorDrawer
        open={drawerOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        loading={createCollector.isPending}
        editCollector={null}
      />
    </PageShell>
  );
}
