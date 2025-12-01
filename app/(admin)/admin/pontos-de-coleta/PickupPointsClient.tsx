'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, App } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import EntitySearchFilters from '@/components/shared/EntitySearchFilters';
import PointsTable from '@/components/pickup/PointsTable';
import PointDrawer from '@/components/pickup/PointDrawer';
import { usePickupPointsAPI } from '@/hooks/usePickupPointsAPI';
import type { PickupPointFilters, PickupPointFormData, PickupPointListResponse } from '@/lib/pickup/types';
import { PageShell } from '@/components/shared/PageShell';

export default function PickupPointsClient() {
  const { message } = App.useApp();
  const router = useRouter();
  const [filters, setFilters] = useState<PickupPointFilters>({ status: 'all', page: 1, pageSize: 10 });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [data, setData] = useState<PickupPointListResponse>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
  });
  const [isLoading, setIsLoading] = useState(false);

  const api = usePickupPointsAPI();

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await api.fetchPoints(filters);
      setData(result);
    } catch {
      message.error('Erro ao carregar pontos de coleta');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Carregar dados quando filtros mudarem
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFiltersChange = (newFilters: PickupPointFilters) => {
    setFilters({ ...newFilters, page: 1, pageSize: filters.pageSize });
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setFilters({ ...filters, page, pageSize });
  };

  const handleAdd = () => {
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  const handleSubmit = async (formData: PickupPointFormData) => {
    try {
      const result = await api.createPoint(formData);
      message.success('Ponto criado com sucesso');
      handleDrawerClose();
      // Navegar para a página de detalhes do novo ponto
      if (result?.id) {
        router.push(`/admin/pontos-de-coleta/${result.id}`);
      } else {
        await loadData();
      }
    } catch {
      message.error(api.error || 'Erro ao criar ponto');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deletePoint(id);
      message.success('Ponto excluído com sucesso');
      await loadData();
    } catch {
      message.error(api.error || 'Erro ao excluir ponto');
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      await api.toggleStatus(id);
      message.success('Status atualizado');
      await loadData();
    } catch {
      message.error(api.error || 'Erro ao atualizar status');
    }
  };

  return (
    <PageShell
      title="Pontos de Coleta"
      gap="md"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Adicionar Ponto
        </Button>
      }
    >
      <Card>
        <EntitySearchFilters<PickupPointFilters>
          onChange={handleFiltersChange}
          searchPlaceholder="Nome/CNPJ..."
          statusOptions={[
            { label: 'Todos', value: 'all' },
            { label: 'Ativo', value: 'ACTIVE' },
            { label: 'Bloqueado', value: 'BLOCKED' },
          ]}
        />
        <PointsTable
          data={data}
          loading={isLoading || api.loading}
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
          onPageChange={handlePageChange}
        />
      </Card>

      <PointDrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        onSubmit={handleSubmit}
        loading={api.loading}
        editPoint={null}
      />
    </PageShell>
  );
}
